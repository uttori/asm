import { createRequire as __createRequire } from 'node:module';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __dirname_fn } from 'node:path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_fn(__filename);
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
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// node_modules/vscode-languageserver/lib/common/utils/is.js
var require_is = __commonJS({
  "node_modules/vscode-languageserver/lib/common/utils/is.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.thenable = exports.typedArray = exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = void 0;
    function boolean(value) {
      return value === true || value === false;
    }
    exports.boolean = boolean;
    function string(value) {
      return typeof value === "string" || value instanceof String;
    }
    exports.string = string;
    function number(value) {
      return typeof value === "number" || value instanceof Number;
    }
    exports.number = number;
    function error(value) {
      return value instanceof Error;
    }
    exports.error = error;
    function func(value) {
      return typeof value === "function";
    }
    exports.func = func;
    function array(value) {
      return Array.isArray(value);
    }
    exports.array = array;
    function stringArray(value) {
      return array(value) && value.every((elem) => string(elem));
    }
    exports.stringArray = stringArray;
    function typedArray(value, check) {
      return Array.isArray(value) && value.every(check);
    }
    exports.typedArray = typedArray;
    function thenable(value) {
      return value && func(value.then);
    }
    exports.thenable = thenable;
  }
});

// node_modules/vscode-jsonrpc/lib/common/is.js
var require_is2 = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/is.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = void 0;
    function boolean(value) {
      return value === true || value === false;
    }
    exports.boolean = boolean;
    function string(value) {
      return typeof value === "string" || value instanceof String;
    }
    exports.string = string;
    function number(value) {
      return typeof value === "number" || value instanceof Number;
    }
    exports.number = number;
    function error(value) {
      return value instanceof Error;
    }
    exports.error = error;
    function func(value) {
      return typeof value === "function";
    }
    exports.func = func;
    function array(value) {
      return Array.isArray(value);
    }
    exports.array = array;
    function stringArray(value) {
      return array(value) && value.every((elem) => string(elem));
    }
    exports.stringArray = stringArray;
  }
});

// node_modules/vscode-jsonrpc/lib/common/messages.js
var require_messages = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Message = exports.NotificationType9 = exports.NotificationType8 = exports.NotificationType7 = exports.NotificationType6 = exports.NotificationType5 = exports.NotificationType4 = exports.NotificationType3 = exports.NotificationType2 = exports.NotificationType1 = exports.NotificationType0 = exports.NotificationType = exports.RequestType9 = exports.RequestType8 = exports.RequestType7 = exports.RequestType6 = exports.RequestType5 = exports.RequestType4 = exports.RequestType3 = exports.RequestType2 = exports.RequestType1 = exports.RequestType = exports.RequestType0 = exports.AbstractMessageSignature = exports.ParameterStructures = exports.ResponseError = exports.ErrorCodes = void 0;
    var is = require_is2();
    var ErrorCodes;
    (function(ErrorCodes2) {
      ErrorCodes2.ParseError = -32700;
      ErrorCodes2.InvalidRequest = -32600;
      ErrorCodes2.MethodNotFound = -32601;
      ErrorCodes2.InvalidParams = -32602;
      ErrorCodes2.InternalError = -32603;
      ErrorCodes2.jsonrpcReservedErrorRangeStart = -32099;
      ErrorCodes2.serverErrorStart = -32099;
      ErrorCodes2.MessageWriteError = -32099;
      ErrorCodes2.MessageReadError = -32098;
      ErrorCodes2.PendingResponseRejected = -32097;
      ErrorCodes2.ConnectionInactive = -32096;
      ErrorCodes2.ServerNotInitialized = -32002;
      ErrorCodes2.UnknownErrorCode = -32001;
      ErrorCodes2.jsonrpcReservedErrorRangeEnd = -32e3;
      ErrorCodes2.serverErrorEnd = -32e3;
    })(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));
    var ResponseError = class _ResponseError extends Error {
      constructor(code, message, data) {
        super(message);
        this.code = is.number(code) ? code : ErrorCodes.UnknownErrorCode;
        this.data = data;
        Object.setPrototypeOf(this, _ResponseError.prototype);
      }
      toJson() {
        const result = {
          code: this.code,
          message: this.message
        };
        if (this.data !== void 0) {
          result.data = this.data;
        }
        return result;
      }
    };
    exports.ResponseError = ResponseError;
    var ParameterStructures = class _ParameterStructures {
      constructor(kind) {
        this.kind = kind;
      }
      static is(value) {
        return value === _ParameterStructures.auto || value === _ParameterStructures.byName || value === _ParameterStructures.byPosition;
      }
      toString() {
        return this.kind;
      }
    };
    exports.ParameterStructures = ParameterStructures;
    ParameterStructures.auto = new ParameterStructures("auto");
    ParameterStructures.byPosition = new ParameterStructures("byPosition");
    ParameterStructures.byName = new ParameterStructures("byName");
    var AbstractMessageSignature = class {
      constructor(method, numberOfParams) {
        this.method = method;
        this.numberOfParams = numberOfParams;
      }
      get parameterStructures() {
        return ParameterStructures.auto;
      }
    };
    exports.AbstractMessageSignature = AbstractMessageSignature;
    var RequestType0 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 0);
      }
    };
    exports.RequestType0 = RequestType0;
    var RequestType = class extends AbstractMessageSignature {
      constructor(method, _parameterStructures = ParameterStructures.auto) {
        super(method, 1);
        this._parameterStructures = _parameterStructures;
      }
      get parameterStructures() {
        return this._parameterStructures;
      }
    };
    exports.RequestType = RequestType;
    var RequestType1 = class extends AbstractMessageSignature {
      constructor(method, _parameterStructures = ParameterStructures.auto) {
        super(method, 1);
        this._parameterStructures = _parameterStructures;
      }
      get parameterStructures() {
        return this._parameterStructures;
      }
    };
    exports.RequestType1 = RequestType1;
    var RequestType2 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 2);
      }
    };
    exports.RequestType2 = RequestType2;
    var RequestType3 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 3);
      }
    };
    exports.RequestType3 = RequestType3;
    var RequestType4 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 4);
      }
    };
    exports.RequestType4 = RequestType4;
    var RequestType5 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 5);
      }
    };
    exports.RequestType5 = RequestType5;
    var RequestType6 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 6);
      }
    };
    exports.RequestType6 = RequestType6;
    var RequestType7 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 7);
      }
    };
    exports.RequestType7 = RequestType7;
    var RequestType8 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 8);
      }
    };
    exports.RequestType8 = RequestType8;
    var RequestType9 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 9);
      }
    };
    exports.RequestType9 = RequestType9;
    var NotificationType = class extends AbstractMessageSignature {
      constructor(method, _parameterStructures = ParameterStructures.auto) {
        super(method, 1);
        this._parameterStructures = _parameterStructures;
      }
      get parameterStructures() {
        return this._parameterStructures;
      }
    };
    exports.NotificationType = NotificationType;
    var NotificationType0 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 0);
      }
    };
    exports.NotificationType0 = NotificationType0;
    var NotificationType1 = class extends AbstractMessageSignature {
      constructor(method, _parameterStructures = ParameterStructures.auto) {
        super(method, 1);
        this._parameterStructures = _parameterStructures;
      }
      get parameterStructures() {
        return this._parameterStructures;
      }
    };
    exports.NotificationType1 = NotificationType1;
    var NotificationType2 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 2);
      }
    };
    exports.NotificationType2 = NotificationType2;
    var NotificationType3 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 3);
      }
    };
    exports.NotificationType3 = NotificationType3;
    var NotificationType4 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 4);
      }
    };
    exports.NotificationType4 = NotificationType4;
    var NotificationType5 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 5);
      }
    };
    exports.NotificationType5 = NotificationType5;
    var NotificationType6 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 6);
      }
    };
    exports.NotificationType6 = NotificationType6;
    var NotificationType7 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 7);
      }
    };
    exports.NotificationType7 = NotificationType7;
    var NotificationType8 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 8);
      }
    };
    exports.NotificationType8 = NotificationType8;
    var NotificationType9 = class extends AbstractMessageSignature {
      constructor(method) {
        super(method, 9);
      }
    };
    exports.NotificationType9 = NotificationType9;
    var Message;
    (function(Message2) {
      function isRequest(message) {
        const candidate = message;
        return candidate && is.string(candidate.method) && (is.string(candidate.id) || is.number(candidate.id));
      }
      Message2.isRequest = isRequest;
      function isNotification(message) {
        const candidate = message;
        return candidate && is.string(candidate.method) && message.id === void 0;
      }
      Message2.isNotification = isNotification;
      function isResponse(message) {
        const candidate = message;
        return candidate && (candidate.result !== void 0 || !!candidate.error) && (is.string(candidate.id) || is.number(candidate.id) || candidate.id === null);
      }
      Message2.isResponse = isResponse;
    })(Message || (exports.Message = Message = {}));
  }
});

// node_modules/vscode-jsonrpc/lib/common/linkedMap.js
var require_linkedMap = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/linkedMap.js"(exports) {
    "use strict";
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LRUCache = exports.LinkedMap = exports.Touch = void 0;
    var Touch;
    (function(Touch2) {
      Touch2.None = 0;
      Touch2.First = 1;
      Touch2.AsOld = Touch2.First;
      Touch2.Last = 2;
      Touch2.AsNew = Touch2.Last;
    })(Touch || (exports.Touch = Touch = {}));
    var LinkedMap = class {
      constructor() {
        this[_a] = "LinkedMap";
        this._map = /* @__PURE__ */ new Map();
        this._head = void 0;
        this._tail = void 0;
        this._size = 0;
        this._state = 0;
      }
      clear() {
        this._map.clear();
        this._head = void 0;
        this._tail = void 0;
        this._size = 0;
        this._state++;
      }
      isEmpty() {
        return !this._head && !this._tail;
      }
      get size() {
        return this._size;
      }
      get first() {
        return this._head?.value;
      }
      get last() {
        return this._tail?.value;
      }
      has(key) {
        return this._map.has(key);
      }
      get(key, touch = Touch.None) {
        const item = this._map.get(key);
        if (!item) {
          return void 0;
        }
        if (touch !== Touch.None) {
          this.touch(item, touch);
        }
        return item.value;
      }
      set(key, value, touch = Touch.None) {
        let item = this._map.get(key);
        if (item) {
          item.value = value;
          if (touch !== Touch.None) {
            this.touch(item, touch);
          }
        } else {
          item = { key, value, next: void 0, previous: void 0 };
          switch (touch) {
            case Touch.None:
              this.addItemLast(item);
              break;
            case Touch.First:
              this.addItemFirst(item);
              break;
            case Touch.Last:
              this.addItemLast(item);
              break;
            default:
              this.addItemLast(item);
              break;
          }
          this._map.set(key, item);
          this._size++;
        }
        return this;
      }
      delete(key) {
        return !!this.remove(key);
      }
      remove(key) {
        const item = this._map.get(key);
        if (!item) {
          return void 0;
        }
        this._map.delete(key);
        this.removeItem(item);
        this._size--;
        return item.value;
      }
      shift() {
        if (!this._head && !this._tail) {
          return void 0;
        }
        if (!this._head || !this._tail) {
          throw new Error("Invalid list");
        }
        const item = this._head;
        this._map.delete(item.key);
        this.removeItem(item);
        this._size--;
        return item.value;
      }
      forEach(callbackfn, thisArg) {
        const state = this._state;
        let current = this._head;
        while (current) {
          if (thisArg) {
            callbackfn.bind(thisArg)(current.value, current.key, this);
          } else {
            callbackfn(current.value, current.key, this);
          }
          if (this._state !== state) {
            throw new Error(`LinkedMap got modified during iteration.`);
          }
          current = current.next;
        }
      }
      keys() {
        const state = this._state;
        let current = this._head;
        const iterator = {
          [Symbol.iterator]: () => {
            return iterator;
          },
          next: () => {
            if (this._state !== state) {
              throw new Error(`LinkedMap got modified during iteration.`);
            }
            if (current) {
              const result = { value: current.key, done: false };
              current = current.next;
              return result;
            } else {
              return { value: void 0, done: true };
            }
          }
        };
        return iterator;
      }
      values() {
        const state = this._state;
        let current = this._head;
        const iterator = {
          [Symbol.iterator]: () => {
            return iterator;
          },
          next: () => {
            if (this._state !== state) {
              throw new Error(`LinkedMap got modified during iteration.`);
            }
            if (current) {
              const result = { value: current.value, done: false };
              current = current.next;
              return result;
            } else {
              return { value: void 0, done: true };
            }
          }
        };
        return iterator;
      }
      entries() {
        const state = this._state;
        let current = this._head;
        const iterator = {
          [Symbol.iterator]: () => {
            return iterator;
          },
          next: () => {
            if (this._state !== state) {
              throw new Error(`LinkedMap got modified during iteration.`);
            }
            if (current) {
              const result = { value: [current.key, current.value], done: false };
              current = current.next;
              return result;
            } else {
              return { value: void 0, done: true };
            }
          }
        };
        return iterator;
      }
      [(_a = Symbol.toStringTag, Symbol.iterator)]() {
        return this.entries();
      }
      trimOld(newSize) {
        if (newSize >= this.size) {
          return;
        }
        if (newSize === 0) {
          this.clear();
          return;
        }
        let current = this._head;
        let currentSize = this.size;
        while (current && currentSize > newSize) {
          this._map.delete(current.key);
          current = current.next;
          currentSize--;
        }
        this._head = current;
        this._size = currentSize;
        if (current) {
          current.previous = void 0;
        }
        this._state++;
      }
      addItemFirst(item) {
        if (!this._head && !this._tail) {
          this._tail = item;
        } else if (!this._head) {
          throw new Error("Invalid list");
        } else {
          item.next = this._head;
          this._head.previous = item;
        }
        this._head = item;
        this._state++;
      }
      addItemLast(item) {
        if (!this._head && !this._tail) {
          this._head = item;
        } else if (!this._tail) {
          throw new Error("Invalid list");
        } else {
          item.previous = this._tail;
          this._tail.next = item;
        }
        this._tail = item;
        this._state++;
      }
      removeItem(item) {
        if (item === this._head && item === this._tail) {
          this._head = void 0;
          this._tail = void 0;
        } else if (item === this._head) {
          if (!item.next) {
            throw new Error("Invalid list");
          }
          item.next.previous = void 0;
          this._head = item.next;
        } else if (item === this._tail) {
          if (!item.previous) {
            throw new Error("Invalid list");
          }
          item.previous.next = void 0;
          this._tail = item.previous;
        } else {
          const next = item.next;
          const previous = item.previous;
          if (!next || !previous) {
            throw new Error("Invalid list");
          }
          next.previous = previous;
          previous.next = next;
        }
        item.next = void 0;
        item.previous = void 0;
        this._state++;
      }
      touch(item, touch) {
        if (!this._head || !this._tail) {
          throw new Error("Invalid list");
        }
        if (touch !== Touch.First && touch !== Touch.Last) {
          return;
        }
        if (touch === Touch.First) {
          if (item === this._head) {
            return;
          }
          const next = item.next;
          const previous = item.previous;
          if (item === this._tail) {
            previous.next = void 0;
            this._tail = previous;
          } else {
            next.previous = previous;
            previous.next = next;
          }
          item.previous = void 0;
          item.next = this._head;
          this._head.previous = item;
          this._head = item;
          this._state++;
        } else if (touch === Touch.Last) {
          if (item === this._tail) {
            return;
          }
          const next = item.next;
          const previous = item.previous;
          if (item === this._head) {
            next.previous = void 0;
            this._head = next;
          } else {
            next.previous = previous;
            previous.next = next;
          }
          item.next = void 0;
          item.previous = this._tail;
          this._tail.next = item;
          this._tail = item;
          this._state++;
        }
      }
      toJSON() {
        const data = [];
        this.forEach((value, key) => {
          data.push([key, value]);
        });
        return data;
      }
      fromJSON(data) {
        this.clear();
        for (const [key, value] of data) {
          this.set(key, value);
        }
      }
    };
    exports.LinkedMap = LinkedMap;
    var LRUCache = class extends LinkedMap {
      constructor(limit, ratio = 1) {
        super();
        this._limit = limit;
        this._ratio = Math.min(Math.max(0, ratio), 1);
      }
      get limit() {
        return this._limit;
      }
      set limit(limit) {
        this._limit = limit;
        this.checkTrim();
      }
      get ratio() {
        return this._ratio;
      }
      set ratio(ratio) {
        this._ratio = Math.min(Math.max(0, ratio), 1);
        this.checkTrim();
      }
      get(key, touch = Touch.AsNew) {
        return super.get(key, touch);
      }
      peek(key) {
        return super.get(key, Touch.None);
      }
      set(key, value) {
        super.set(key, value, Touch.Last);
        this.checkTrim();
        return this;
      }
      checkTrim() {
        if (this.size > this._limit) {
          this.trimOld(Math.round(this._limit * this._ratio));
        }
      }
    };
    exports.LRUCache = LRUCache;
  }
});

// node_modules/vscode-jsonrpc/lib/common/disposable.js
var require_disposable = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/disposable.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Disposable = void 0;
    var Disposable;
    (function(Disposable2) {
      function create(func) {
        return {
          dispose: func
        };
      }
      Disposable2.create = create;
    })(Disposable || (exports.Disposable = Disposable = {}));
  }
});

// node_modules/vscode-jsonrpc/lib/common/ral.js
var require_ral = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/ral.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var _ral;
    function RAL() {
      if (_ral === void 0) {
        throw new Error(`No runtime abstraction layer installed`);
      }
      return _ral;
    }
    (function(RAL2) {
      function install(ral) {
        if (ral === void 0) {
          throw new Error(`No runtime abstraction layer provided`);
        }
        _ral = ral;
      }
      RAL2.install = install;
    })(RAL || (RAL = {}));
    exports.default = RAL;
  }
});

// node_modules/vscode-jsonrpc/lib/common/events.js
var require_events = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/events.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Emitter = exports.Event = void 0;
    var ral_1 = require_ral();
    var Event;
    (function(Event2) {
      const _disposable = { dispose() {
      } };
      Event2.None = function() {
        return _disposable;
      };
    })(Event || (exports.Event = Event = {}));
    var CallbackList = class {
      add(callback, context = null, bucket) {
        if (!this._callbacks) {
          this._callbacks = [];
          this._contexts = [];
        }
        this._callbacks.push(callback);
        this._contexts.push(context);
        if (Array.isArray(bucket)) {
          bucket.push({ dispose: () => this.remove(callback, context) });
        }
      }
      remove(callback, context = null) {
        if (!this._callbacks) {
          return;
        }
        let foundCallbackWithDifferentContext = false;
        for (let i = 0, len = this._callbacks.length; i < len; i++) {
          if (this._callbacks[i] === callback) {
            if (this._contexts[i] === context) {
              this._callbacks.splice(i, 1);
              this._contexts.splice(i, 1);
              return;
            } else {
              foundCallbackWithDifferentContext = true;
            }
          }
        }
        if (foundCallbackWithDifferentContext) {
          throw new Error("When adding a listener with a context, you should remove it with the same context");
        }
      }
      invoke(...args) {
        if (!this._callbacks) {
          return [];
        }
        const ret = [], callbacks = this._callbacks.slice(0), contexts = this._contexts.slice(0);
        for (let i = 0, len = callbacks.length; i < len; i++) {
          try {
            ret.push(callbacks[i].apply(contexts[i], args));
          } catch (e) {
            (0, ral_1.default)().console.error(e);
          }
        }
        return ret;
      }
      isEmpty() {
        return !this._callbacks || this._callbacks.length === 0;
      }
      dispose() {
        this._callbacks = void 0;
        this._contexts = void 0;
      }
    };
    var Emitter = class _Emitter {
      constructor(_options) {
        this._options = _options;
      }
      /**
       * For the public to allow to subscribe
       * to events from this Emitter
       */
      get event() {
        if (!this._event) {
          this._event = (listener, thisArgs, disposables) => {
            if (!this._callbacks) {
              this._callbacks = new CallbackList();
            }
            if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) {
              this._options.onFirstListenerAdd(this);
            }
            this._callbacks.add(listener, thisArgs);
            const result = {
              dispose: () => {
                if (!this._callbacks) {
                  return;
                }
                this._callbacks.remove(listener, thisArgs);
                result.dispose = _Emitter._noop;
                if (this._options && this._options.onLastListenerRemove && this._callbacks.isEmpty()) {
                  this._options.onLastListenerRemove(this);
                }
              }
            };
            if (Array.isArray(disposables)) {
              disposables.push(result);
            }
            return result;
          };
        }
        return this._event;
      }
      /**
       * To be kept private to fire an event to
       * subscribers
       */
      fire(event) {
        if (this._callbacks) {
          this._callbacks.invoke.call(this._callbacks, event);
        }
      }
      dispose() {
        if (this._callbacks) {
          this._callbacks.dispose();
          this._callbacks = void 0;
        }
      }
    };
    exports.Emitter = Emitter;
    Emitter._noop = function() {
    };
  }
});

// node_modules/vscode-jsonrpc/lib/common/cancellation.js
var require_cancellation = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/cancellation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CancellationTokenSource = exports.CancellationToken = void 0;
    var ral_1 = require_ral();
    var Is = require_is2();
    var events_1 = require_events();
    var CancellationToken;
    (function(CancellationToken2) {
      CancellationToken2.None = Object.freeze({
        isCancellationRequested: false,
        onCancellationRequested: events_1.Event.None
      });
      CancellationToken2.Cancelled = Object.freeze({
        isCancellationRequested: true,
        onCancellationRequested: events_1.Event.None
      });
      function is(value) {
        const candidate = value;
        return candidate && (candidate === CancellationToken2.None || candidate === CancellationToken2.Cancelled || Is.boolean(candidate.isCancellationRequested) && !!candidate.onCancellationRequested);
      }
      CancellationToken2.is = is;
    })(CancellationToken || (exports.CancellationToken = CancellationToken = {}));
    var shortcutEvent = Object.freeze(function(callback, context) {
      const handle = (0, ral_1.default)().timer.setTimeout(callback.bind(context), 0);
      return { dispose() {
        handle.dispose();
      } };
    });
    var MutableToken = class {
      constructor() {
        this._isCancelled = false;
      }
      cancel() {
        if (!this._isCancelled) {
          this._isCancelled = true;
          if (this._emitter) {
            this._emitter.fire(void 0);
            this.dispose();
          }
        }
      }
      get isCancellationRequested() {
        return this._isCancelled;
      }
      get onCancellationRequested() {
        if (this._isCancelled) {
          return shortcutEvent;
        }
        if (!this._emitter) {
          this._emitter = new events_1.Emitter();
        }
        return this._emitter.event;
      }
      dispose() {
        if (this._emitter) {
          this._emitter.dispose();
          this._emitter = void 0;
        }
      }
    };
    var CancellationTokenSource = class {
      get token() {
        if (!this._token) {
          this._token = new MutableToken();
        }
        return this._token;
      }
      cancel() {
        if (!this._token) {
          this._token = CancellationToken.Cancelled;
        } else {
          this._token.cancel();
        }
      }
      dispose() {
        if (!this._token) {
          this._token = CancellationToken.None;
        } else if (this._token instanceof MutableToken) {
          this._token.dispose();
        }
      }
    };
    exports.CancellationTokenSource = CancellationTokenSource;
  }
});

// node_modules/vscode-jsonrpc/lib/common/sharedArrayCancellation.js
var require_sharedArrayCancellation = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/sharedArrayCancellation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SharedArrayReceiverStrategy = exports.SharedArraySenderStrategy = void 0;
    var cancellation_1 = require_cancellation();
    var CancellationState;
    (function(CancellationState2) {
      CancellationState2.Continue = 0;
      CancellationState2.Cancelled = 1;
    })(CancellationState || (CancellationState = {}));
    var SharedArraySenderStrategy = class {
      constructor() {
        this.buffers = /* @__PURE__ */ new Map();
      }
      enableCancellation(request) {
        if (request.id === null) {
          return;
        }
        const buffer = new SharedArrayBuffer(4);
        const data = new Int32Array(buffer, 0, 1);
        data[0] = CancellationState.Continue;
        this.buffers.set(request.id, buffer);
        request.$cancellationData = buffer;
      }
      async sendCancellation(_conn, id) {
        const buffer = this.buffers.get(id);
        if (buffer === void 0) {
          return;
        }
        const data = new Int32Array(buffer, 0, 1);
        Atomics.store(data, 0, CancellationState.Cancelled);
      }
      cleanup(id) {
        this.buffers.delete(id);
      }
      dispose() {
        this.buffers.clear();
      }
    };
    exports.SharedArraySenderStrategy = SharedArraySenderStrategy;
    var SharedArrayBufferCancellationToken = class {
      constructor(buffer) {
        this.data = new Int32Array(buffer, 0, 1);
      }
      get isCancellationRequested() {
        return Atomics.load(this.data, 0) === CancellationState.Cancelled;
      }
      get onCancellationRequested() {
        throw new Error(`Cancellation over SharedArrayBuffer doesn't support cancellation events`);
      }
    };
    var SharedArrayBufferCancellationTokenSource = class {
      constructor(buffer) {
        this.token = new SharedArrayBufferCancellationToken(buffer);
      }
      cancel() {
      }
      dispose() {
      }
    };
    var SharedArrayReceiverStrategy = class {
      constructor() {
        this.kind = "request";
      }
      createCancellationTokenSource(request) {
        const buffer = request.$cancellationData;
        if (buffer === void 0) {
          return new cancellation_1.CancellationTokenSource();
        }
        return new SharedArrayBufferCancellationTokenSource(buffer);
      }
    };
    exports.SharedArrayReceiverStrategy = SharedArrayReceiverStrategy;
  }
});

// node_modules/vscode-jsonrpc/lib/common/semaphore.js
var require_semaphore = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/semaphore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Semaphore = void 0;
    var ral_1 = require_ral();
    var Semaphore = class {
      constructor(capacity = 1) {
        if (capacity <= 0) {
          throw new Error("Capacity must be greater than 0");
        }
        this._capacity = capacity;
        this._active = 0;
        this._waiting = [];
      }
      lock(thunk) {
        return new Promise((resolve, reject) => {
          this._waiting.push({ thunk, resolve, reject });
          this.runNext();
        });
      }
      get active() {
        return this._active;
      }
      runNext() {
        if (this._waiting.length === 0 || this._active === this._capacity) {
          return;
        }
        (0, ral_1.default)().timer.setImmediate(() => this.doRunNext());
      }
      doRunNext() {
        if (this._waiting.length === 0 || this._active === this._capacity) {
          return;
        }
        const next = this._waiting.shift();
        this._active++;
        if (this._active > this._capacity) {
          throw new Error(`To many thunks active`);
        }
        try {
          const result = next.thunk();
          if (result instanceof Promise) {
            result.then((value) => {
              this._active--;
              next.resolve(value);
              this.runNext();
            }, (err) => {
              this._active--;
              next.reject(err);
              this.runNext();
            });
          } else {
            this._active--;
            next.resolve(result);
            this.runNext();
          }
        } catch (err) {
          this._active--;
          next.reject(err);
          this.runNext();
        }
      }
    };
    exports.Semaphore = Semaphore;
  }
});

// node_modules/vscode-jsonrpc/lib/common/messageReader.js
var require_messageReader = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/messageReader.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ReadableStreamMessageReader = exports.AbstractMessageReader = exports.MessageReader = void 0;
    var ral_1 = require_ral();
    var Is = require_is2();
    var events_1 = require_events();
    var semaphore_1 = require_semaphore();
    var MessageReader;
    (function(MessageReader2) {
      function is(value) {
        let candidate = value;
        return candidate && Is.func(candidate.listen) && Is.func(candidate.dispose) && Is.func(candidate.onError) && Is.func(candidate.onClose) && Is.func(candidate.onPartialMessage);
      }
      MessageReader2.is = is;
    })(MessageReader || (exports.MessageReader = MessageReader = {}));
    var AbstractMessageReader = class {
      constructor() {
        this.errorEmitter = new events_1.Emitter();
        this.closeEmitter = new events_1.Emitter();
        this.partialMessageEmitter = new events_1.Emitter();
      }
      dispose() {
        this.errorEmitter.dispose();
        this.closeEmitter.dispose();
      }
      get onError() {
        return this.errorEmitter.event;
      }
      fireError(error) {
        this.errorEmitter.fire(this.asError(error));
      }
      get onClose() {
        return this.closeEmitter.event;
      }
      fireClose() {
        this.closeEmitter.fire(void 0);
      }
      get onPartialMessage() {
        return this.partialMessageEmitter.event;
      }
      firePartialMessage(info) {
        this.partialMessageEmitter.fire(info);
      }
      asError(error) {
        if (error instanceof Error) {
          return error;
        } else {
          return new Error(`Reader received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
        }
      }
    };
    exports.AbstractMessageReader = AbstractMessageReader;
    var ResolvedMessageReaderOptions;
    (function(ResolvedMessageReaderOptions2) {
      function fromOptions(options) {
        let charset;
        let result;
        let contentDecoder;
        const contentDecoders = /* @__PURE__ */ new Map();
        let contentTypeDecoder;
        const contentTypeDecoders = /* @__PURE__ */ new Map();
        if (options === void 0 || typeof options === "string") {
          charset = options ?? "utf-8";
        } else {
          charset = options.charset ?? "utf-8";
          if (options.contentDecoder !== void 0) {
            contentDecoder = options.contentDecoder;
            contentDecoders.set(contentDecoder.name, contentDecoder);
          }
          if (options.contentDecoders !== void 0) {
            for (const decoder of options.contentDecoders) {
              contentDecoders.set(decoder.name, decoder);
            }
          }
          if (options.contentTypeDecoder !== void 0) {
            contentTypeDecoder = options.contentTypeDecoder;
            contentTypeDecoders.set(contentTypeDecoder.name, contentTypeDecoder);
          }
          if (options.contentTypeDecoders !== void 0) {
            for (const decoder of options.contentTypeDecoders) {
              contentTypeDecoders.set(decoder.name, decoder);
            }
          }
        }
        if (contentTypeDecoder === void 0) {
          contentTypeDecoder = (0, ral_1.default)().applicationJson.decoder;
          contentTypeDecoders.set(contentTypeDecoder.name, contentTypeDecoder);
        }
        return { charset, contentDecoder, contentDecoders, contentTypeDecoder, contentTypeDecoders };
      }
      ResolvedMessageReaderOptions2.fromOptions = fromOptions;
    })(ResolvedMessageReaderOptions || (ResolvedMessageReaderOptions = {}));
    var ReadableStreamMessageReader = class extends AbstractMessageReader {
      constructor(readable, options) {
        super();
        this.readable = readable;
        this.options = ResolvedMessageReaderOptions.fromOptions(options);
        this.buffer = (0, ral_1.default)().messageBuffer.create(this.options.charset);
        this._partialMessageTimeout = 1e4;
        this.nextMessageLength = -1;
        this.messageToken = 0;
        this.readSemaphore = new semaphore_1.Semaphore(1);
      }
      set partialMessageTimeout(timeout) {
        this._partialMessageTimeout = timeout;
      }
      get partialMessageTimeout() {
        return this._partialMessageTimeout;
      }
      listen(callback) {
        this.nextMessageLength = -1;
        this.messageToken = 0;
        this.partialMessageTimer = void 0;
        this.callback = callback;
        const result = this.readable.onData((data) => {
          this.onData(data);
        });
        this.readable.onError((error) => this.fireError(error));
        this.readable.onClose(() => this.fireClose());
        return result;
      }
      onData(data) {
        try {
          this.buffer.append(data);
          while (true) {
            if (this.nextMessageLength === -1) {
              const headers = this.buffer.tryReadHeaders(true);
              if (!headers) {
                return;
              }
              const contentLength = headers.get("content-length");
              if (!contentLength) {
                this.fireError(new Error(`Header must provide a Content-Length property.
${JSON.stringify(Object.fromEntries(headers))}`));
                return;
              }
              const length = parseInt(contentLength);
              if (isNaN(length)) {
                this.fireError(new Error(`Content-Length value must be a number. Got ${contentLength}`));
                return;
              }
              this.nextMessageLength = length;
            }
            const body = this.buffer.tryReadBody(this.nextMessageLength);
            if (body === void 0) {
              this.setPartialMessageTimer();
              return;
            }
            this.clearPartialMessageTimer();
            this.nextMessageLength = -1;
            this.readSemaphore.lock(async () => {
              const bytes = this.options.contentDecoder !== void 0 ? await this.options.contentDecoder.decode(body) : body;
              const message = await this.options.contentTypeDecoder.decode(bytes, this.options);
              this.callback(message);
            }).catch((error) => {
              this.fireError(error);
            });
          }
        } catch (error) {
          this.fireError(error);
        }
      }
      clearPartialMessageTimer() {
        if (this.partialMessageTimer) {
          this.partialMessageTimer.dispose();
          this.partialMessageTimer = void 0;
        }
      }
      setPartialMessageTimer() {
        this.clearPartialMessageTimer();
        if (this._partialMessageTimeout <= 0) {
          return;
        }
        this.partialMessageTimer = (0, ral_1.default)().timer.setTimeout((token, timeout) => {
          this.partialMessageTimer = void 0;
          if (token === this.messageToken) {
            this.firePartialMessage({ messageToken: token, waitingTime: timeout });
            this.setPartialMessageTimer();
          }
        }, this._partialMessageTimeout, this.messageToken, this._partialMessageTimeout);
      }
    };
    exports.ReadableStreamMessageReader = ReadableStreamMessageReader;
  }
});

// node_modules/vscode-jsonrpc/lib/common/messageWriter.js
var require_messageWriter = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/messageWriter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WriteableStreamMessageWriter = exports.AbstractMessageWriter = exports.MessageWriter = void 0;
    var ral_1 = require_ral();
    var Is = require_is2();
    var semaphore_1 = require_semaphore();
    var events_1 = require_events();
    var ContentLength = "Content-Length: ";
    var CRLF = "\r\n";
    var MessageWriter;
    (function(MessageWriter2) {
      function is(value) {
        let candidate = value;
        return candidate && Is.func(candidate.dispose) && Is.func(candidate.onClose) && Is.func(candidate.onError) && Is.func(candidate.write);
      }
      MessageWriter2.is = is;
    })(MessageWriter || (exports.MessageWriter = MessageWriter = {}));
    var AbstractMessageWriter = class {
      constructor() {
        this.errorEmitter = new events_1.Emitter();
        this.closeEmitter = new events_1.Emitter();
      }
      dispose() {
        this.errorEmitter.dispose();
        this.closeEmitter.dispose();
      }
      get onError() {
        return this.errorEmitter.event;
      }
      fireError(error, message, count) {
        this.errorEmitter.fire([this.asError(error), message, count]);
      }
      get onClose() {
        return this.closeEmitter.event;
      }
      fireClose() {
        this.closeEmitter.fire(void 0);
      }
      asError(error) {
        if (error instanceof Error) {
          return error;
        } else {
          return new Error(`Writer received error. Reason: ${Is.string(error.message) ? error.message : "unknown"}`);
        }
      }
    };
    exports.AbstractMessageWriter = AbstractMessageWriter;
    var ResolvedMessageWriterOptions;
    (function(ResolvedMessageWriterOptions2) {
      function fromOptions(options) {
        if (options === void 0 || typeof options === "string") {
          return { charset: options ?? "utf-8", contentTypeEncoder: (0, ral_1.default)().applicationJson.encoder };
        } else {
          return { charset: options.charset ?? "utf-8", contentEncoder: options.contentEncoder, contentTypeEncoder: options.contentTypeEncoder ?? (0, ral_1.default)().applicationJson.encoder };
        }
      }
      ResolvedMessageWriterOptions2.fromOptions = fromOptions;
    })(ResolvedMessageWriterOptions || (ResolvedMessageWriterOptions = {}));
    var WriteableStreamMessageWriter = class extends AbstractMessageWriter {
      constructor(writable, options) {
        super();
        this.writable = writable;
        this.options = ResolvedMessageWriterOptions.fromOptions(options);
        this.errorCount = 0;
        this.writeSemaphore = new semaphore_1.Semaphore(1);
        this.writable.onError((error) => this.fireError(error));
        this.writable.onClose(() => this.fireClose());
      }
      async write(msg) {
        return this.writeSemaphore.lock(async () => {
          const payload = this.options.contentTypeEncoder.encode(msg, this.options).then((buffer) => {
            if (this.options.contentEncoder !== void 0) {
              return this.options.contentEncoder.encode(buffer);
            } else {
              return buffer;
            }
          });
          return payload.then((buffer) => {
            const headers = [];
            headers.push(ContentLength, buffer.byteLength.toString(), CRLF);
            headers.push(CRLF);
            return this.doWrite(msg, headers, buffer);
          }, (error) => {
            this.fireError(error);
            throw error;
          });
        });
      }
      async doWrite(msg, headers, data) {
        try {
          await this.writable.write(headers.join(""), "ascii");
          return this.writable.write(data);
        } catch (error) {
          this.handleError(error, msg);
          return Promise.reject(error);
        }
      }
      handleError(error, msg) {
        this.errorCount++;
        this.fireError(error, msg, this.errorCount);
      }
      end() {
        this.writable.end();
      }
    };
    exports.WriteableStreamMessageWriter = WriteableStreamMessageWriter;
  }
});

// node_modules/vscode-jsonrpc/lib/common/messageBuffer.js
var require_messageBuffer = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/messageBuffer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbstractMessageBuffer = void 0;
    var CR = 13;
    var LF = 10;
    var CRLF = "\r\n";
    var AbstractMessageBuffer = class {
      constructor(encoding = "utf-8") {
        this._encoding = encoding;
        this._chunks = [];
        this._totalLength = 0;
      }
      get encoding() {
        return this._encoding;
      }
      append(chunk) {
        const toAppend = typeof chunk === "string" ? this.fromString(chunk, this._encoding) : chunk;
        this._chunks.push(toAppend);
        this._totalLength += toAppend.byteLength;
      }
      tryReadHeaders(lowerCaseKeys = false) {
        if (this._chunks.length === 0) {
          return void 0;
        }
        let state = 0;
        let chunkIndex = 0;
        let offset = 0;
        let chunkBytesRead = 0;
        row: while (chunkIndex < this._chunks.length) {
          const chunk = this._chunks[chunkIndex];
          offset = 0;
          column: while (offset < chunk.length) {
            const value = chunk[offset];
            switch (value) {
              case CR:
                switch (state) {
                  case 0:
                    state = 1;
                    break;
                  case 2:
                    state = 3;
                    break;
                  default:
                    state = 0;
                }
                break;
              case LF:
                switch (state) {
                  case 1:
                    state = 2;
                    break;
                  case 3:
                    state = 4;
                    offset++;
                    break row;
                  default:
                    state = 0;
                }
                break;
              default:
                state = 0;
            }
            offset++;
          }
          chunkBytesRead += chunk.byteLength;
          chunkIndex++;
        }
        if (state !== 4) {
          return void 0;
        }
        const buffer = this._read(chunkBytesRead + offset);
        const result = /* @__PURE__ */ new Map();
        const headers = this.toString(buffer, "ascii").split(CRLF);
        if (headers.length < 2) {
          return result;
        }
        for (let i = 0; i < headers.length - 2; i++) {
          const header = headers[i];
          const index2 = header.indexOf(":");
          if (index2 === -1) {
            throw new Error(`Message header must separate key and value using ':'
${header}`);
          }
          const key = header.substr(0, index2);
          const value = header.substr(index2 + 1).trim();
          result.set(lowerCaseKeys ? key.toLowerCase() : key, value);
        }
        return result;
      }
      tryReadBody(length) {
        if (this._totalLength < length) {
          return void 0;
        }
        return this._read(length);
      }
      get numberOfBytes() {
        return this._totalLength;
      }
      _read(byteCount) {
        if (byteCount === 0) {
          return this.emptyBuffer();
        }
        if (byteCount > this._totalLength) {
          throw new Error(`Cannot read so many bytes!`);
        }
        if (this._chunks[0].byteLength === byteCount) {
          const chunk = this._chunks[0];
          this._chunks.shift();
          this._totalLength -= byteCount;
          return this.asNative(chunk);
        }
        if (this._chunks[0].byteLength > byteCount) {
          const chunk = this._chunks[0];
          const result2 = this.asNative(chunk, byteCount);
          this._chunks[0] = chunk.slice(byteCount);
          this._totalLength -= byteCount;
          return result2;
        }
        const result = this.allocNative(byteCount);
        let resultOffset = 0;
        let chunkIndex = 0;
        while (byteCount > 0) {
          const chunk = this._chunks[chunkIndex];
          if (chunk.byteLength > byteCount) {
            const chunkPart = chunk.slice(0, byteCount);
            result.set(chunkPart, resultOffset);
            resultOffset += byteCount;
            this._chunks[chunkIndex] = chunk.slice(byteCount);
            this._totalLength -= byteCount;
            byteCount -= byteCount;
          } else {
            result.set(chunk, resultOffset);
            resultOffset += chunk.byteLength;
            this._chunks.shift();
            this._totalLength -= chunk.byteLength;
            byteCount -= chunk.byteLength;
          }
        }
        return result;
      }
    };
    exports.AbstractMessageBuffer = AbstractMessageBuffer;
  }
});

// node_modules/vscode-jsonrpc/lib/common/connection.js
var require_connection = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/connection.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createMessageConnection = exports.ConnectionOptions = exports.MessageStrategy = exports.CancellationStrategy = exports.CancellationSenderStrategy = exports.CancellationReceiverStrategy = exports.RequestCancellationReceiverStrategy = exports.IdCancellationReceiverStrategy = exports.ConnectionStrategy = exports.ConnectionError = exports.ConnectionErrors = exports.LogTraceNotification = exports.SetTraceNotification = exports.TraceFormat = exports.TraceValues = exports.Trace = exports.NullLogger = exports.ProgressType = exports.ProgressToken = void 0;
    var ral_1 = require_ral();
    var Is = require_is2();
    var messages_1 = require_messages();
    var linkedMap_1 = require_linkedMap();
    var events_1 = require_events();
    var cancellation_1 = require_cancellation();
    var CancelNotification;
    (function(CancelNotification2) {
      CancelNotification2.type = new messages_1.NotificationType("$/cancelRequest");
    })(CancelNotification || (CancelNotification = {}));
    var ProgressToken;
    (function(ProgressToken2) {
      function is(value) {
        return typeof value === "string" || typeof value === "number";
      }
      ProgressToken2.is = is;
    })(ProgressToken || (exports.ProgressToken = ProgressToken = {}));
    var ProgressNotification;
    (function(ProgressNotification2) {
      ProgressNotification2.type = new messages_1.NotificationType("$/progress");
    })(ProgressNotification || (ProgressNotification = {}));
    var ProgressType = class {
      constructor() {
      }
    };
    exports.ProgressType = ProgressType;
    var StarRequestHandler;
    (function(StarRequestHandler2) {
      function is(value) {
        return Is.func(value);
      }
      StarRequestHandler2.is = is;
    })(StarRequestHandler || (StarRequestHandler = {}));
    exports.NullLogger = Object.freeze({
      error: () => {
      },
      warn: () => {
      },
      info: () => {
      },
      log: () => {
      }
    });
    var Trace;
    (function(Trace2) {
      Trace2[Trace2["Off"] = 0] = "Off";
      Trace2[Trace2["Messages"] = 1] = "Messages";
      Trace2[Trace2["Compact"] = 2] = "Compact";
      Trace2[Trace2["Verbose"] = 3] = "Verbose";
    })(Trace || (exports.Trace = Trace = {}));
    var TraceValues;
    (function(TraceValues2) {
      TraceValues2.Off = "off";
      TraceValues2.Messages = "messages";
      TraceValues2.Compact = "compact";
      TraceValues2.Verbose = "verbose";
    })(TraceValues || (exports.TraceValues = TraceValues = {}));
    (function(Trace2) {
      function fromString(value) {
        if (!Is.string(value)) {
          return Trace2.Off;
        }
        value = value.toLowerCase();
        switch (value) {
          case "off":
            return Trace2.Off;
          case "messages":
            return Trace2.Messages;
          case "compact":
            return Trace2.Compact;
          case "verbose":
            return Trace2.Verbose;
          default:
            return Trace2.Off;
        }
      }
      Trace2.fromString = fromString;
      function toString(value) {
        switch (value) {
          case Trace2.Off:
            return "off";
          case Trace2.Messages:
            return "messages";
          case Trace2.Compact:
            return "compact";
          case Trace2.Verbose:
            return "verbose";
          default:
            return "off";
        }
      }
      Trace2.toString = toString;
    })(Trace || (exports.Trace = Trace = {}));
    var TraceFormat;
    (function(TraceFormat2) {
      TraceFormat2["Text"] = "text";
      TraceFormat2["JSON"] = "json";
    })(TraceFormat || (exports.TraceFormat = TraceFormat = {}));
    (function(TraceFormat2) {
      function fromString(value) {
        if (!Is.string(value)) {
          return TraceFormat2.Text;
        }
        value = value.toLowerCase();
        if (value === "json") {
          return TraceFormat2.JSON;
        } else {
          return TraceFormat2.Text;
        }
      }
      TraceFormat2.fromString = fromString;
    })(TraceFormat || (exports.TraceFormat = TraceFormat = {}));
    var SetTraceNotification;
    (function(SetTraceNotification2) {
      SetTraceNotification2.type = new messages_1.NotificationType("$/setTrace");
    })(SetTraceNotification || (exports.SetTraceNotification = SetTraceNotification = {}));
    var LogTraceNotification;
    (function(LogTraceNotification2) {
      LogTraceNotification2.type = new messages_1.NotificationType("$/logTrace");
    })(LogTraceNotification || (exports.LogTraceNotification = LogTraceNotification = {}));
    var ConnectionErrors;
    (function(ConnectionErrors2) {
      ConnectionErrors2[ConnectionErrors2["Closed"] = 1] = "Closed";
      ConnectionErrors2[ConnectionErrors2["Disposed"] = 2] = "Disposed";
      ConnectionErrors2[ConnectionErrors2["AlreadyListening"] = 3] = "AlreadyListening";
    })(ConnectionErrors || (exports.ConnectionErrors = ConnectionErrors = {}));
    var ConnectionError = class _ConnectionError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
        Object.setPrototypeOf(this, _ConnectionError.prototype);
      }
    };
    exports.ConnectionError = ConnectionError;
    var ConnectionStrategy;
    (function(ConnectionStrategy2) {
      function is(value) {
        const candidate = value;
        return candidate && Is.func(candidate.cancelUndispatched);
      }
      ConnectionStrategy2.is = is;
    })(ConnectionStrategy || (exports.ConnectionStrategy = ConnectionStrategy = {}));
    var IdCancellationReceiverStrategy;
    (function(IdCancellationReceiverStrategy2) {
      function is(value) {
        const candidate = value;
        return candidate && (candidate.kind === void 0 || candidate.kind === "id") && Is.func(candidate.createCancellationTokenSource) && (candidate.dispose === void 0 || Is.func(candidate.dispose));
      }
      IdCancellationReceiverStrategy2.is = is;
    })(IdCancellationReceiverStrategy || (exports.IdCancellationReceiverStrategy = IdCancellationReceiverStrategy = {}));
    var RequestCancellationReceiverStrategy;
    (function(RequestCancellationReceiverStrategy2) {
      function is(value) {
        const candidate = value;
        return candidate && candidate.kind === "request" && Is.func(candidate.createCancellationTokenSource) && (candidate.dispose === void 0 || Is.func(candidate.dispose));
      }
      RequestCancellationReceiverStrategy2.is = is;
    })(RequestCancellationReceiverStrategy || (exports.RequestCancellationReceiverStrategy = RequestCancellationReceiverStrategy = {}));
    var CancellationReceiverStrategy;
    (function(CancellationReceiverStrategy2) {
      CancellationReceiverStrategy2.Message = Object.freeze({
        createCancellationTokenSource(_) {
          return new cancellation_1.CancellationTokenSource();
        }
      });
      function is(value) {
        return IdCancellationReceiverStrategy.is(value) || RequestCancellationReceiverStrategy.is(value);
      }
      CancellationReceiverStrategy2.is = is;
    })(CancellationReceiverStrategy || (exports.CancellationReceiverStrategy = CancellationReceiverStrategy = {}));
    var CancellationSenderStrategy;
    (function(CancellationSenderStrategy2) {
      CancellationSenderStrategy2.Message = Object.freeze({
        sendCancellation(conn, id) {
          return conn.sendNotification(CancelNotification.type, { id });
        },
        cleanup(_) {
        }
      });
      function is(value) {
        const candidate = value;
        return candidate && Is.func(candidate.sendCancellation) && Is.func(candidate.cleanup);
      }
      CancellationSenderStrategy2.is = is;
    })(CancellationSenderStrategy || (exports.CancellationSenderStrategy = CancellationSenderStrategy = {}));
    var CancellationStrategy;
    (function(CancellationStrategy2) {
      CancellationStrategy2.Message = Object.freeze({
        receiver: CancellationReceiverStrategy.Message,
        sender: CancellationSenderStrategy.Message
      });
      function is(value) {
        const candidate = value;
        return candidate && CancellationReceiverStrategy.is(candidate.receiver) && CancellationSenderStrategy.is(candidate.sender);
      }
      CancellationStrategy2.is = is;
    })(CancellationStrategy || (exports.CancellationStrategy = CancellationStrategy = {}));
    var MessageStrategy;
    (function(MessageStrategy2) {
      function is(value) {
        const candidate = value;
        return candidate && Is.func(candidate.handleMessage);
      }
      MessageStrategy2.is = is;
    })(MessageStrategy || (exports.MessageStrategy = MessageStrategy = {}));
    var ConnectionOptions;
    (function(ConnectionOptions2) {
      function is(value) {
        const candidate = value;
        return candidate && (CancellationStrategy.is(candidate.cancellationStrategy) || ConnectionStrategy.is(candidate.connectionStrategy) || MessageStrategy.is(candidate.messageStrategy));
      }
      ConnectionOptions2.is = is;
    })(ConnectionOptions || (exports.ConnectionOptions = ConnectionOptions = {}));
    var ConnectionState;
    (function(ConnectionState2) {
      ConnectionState2[ConnectionState2["New"] = 1] = "New";
      ConnectionState2[ConnectionState2["Listening"] = 2] = "Listening";
      ConnectionState2[ConnectionState2["Closed"] = 3] = "Closed";
      ConnectionState2[ConnectionState2["Disposed"] = 4] = "Disposed";
    })(ConnectionState || (ConnectionState = {}));
    function createMessageConnection(messageReader, messageWriter, _logger, options) {
      const logger = _logger !== void 0 ? _logger : exports.NullLogger;
      let sequenceNumber = 0;
      let notificationSequenceNumber = 0;
      let unknownResponseSequenceNumber = 0;
      const version = "2.0";
      let starRequestHandler = void 0;
      const requestHandlers = /* @__PURE__ */ new Map();
      let starNotificationHandler = void 0;
      const notificationHandlers = /* @__PURE__ */ new Map();
      const progressHandlers = /* @__PURE__ */ new Map();
      let timer;
      let messageQueue = new linkedMap_1.LinkedMap();
      let responsePromises = /* @__PURE__ */ new Map();
      let knownCanceledRequests = /* @__PURE__ */ new Set();
      let requestTokens = /* @__PURE__ */ new Map();
      let trace = Trace.Off;
      let traceFormat = TraceFormat.Text;
      let tracer;
      let state = ConnectionState.New;
      const errorEmitter = new events_1.Emitter();
      const closeEmitter = new events_1.Emitter();
      const unhandledNotificationEmitter = new events_1.Emitter();
      const unhandledProgressEmitter = new events_1.Emitter();
      const disposeEmitter = new events_1.Emitter();
      const cancellationStrategy = options && options.cancellationStrategy ? options.cancellationStrategy : CancellationStrategy.Message;
      function createRequestQueueKey(id) {
        if (id === null) {
          throw new Error(`Can't send requests with id null since the response can't be correlated.`);
        }
        return "req-" + id.toString();
      }
      function createResponseQueueKey(id) {
        if (id === null) {
          return "res-unknown-" + (++unknownResponseSequenceNumber).toString();
        } else {
          return "res-" + id.toString();
        }
      }
      function createNotificationQueueKey() {
        return "not-" + (++notificationSequenceNumber).toString();
      }
      function addMessageToQueue(queue, message) {
        if (messages_1.Message.isRequest(message)) {
          queue.set(createRequestQueueKey(message.id), message);
        } else if (messages_1.Message.isResponse(message)) {
          queue.set(createResponseQueueKey(message.id), message);
        } else {
          queue.set(createNotificationQueueKey(), message);
        }
      }
      function cancelUndispatched(_message) {
        return void 0;
      }
      function isListening() {
        return state === ConnectionState.Listening;
      }
      function isClosed() {
        return state === ConnectionState.Closed;
      }
      function isDisposed() {
        return state === ConnectionState.Disposed;
      }
      function closeHandler() {
        if (state === ConnectionState.New || state === ConnectionState.Listening) {
          state = ConnectionState.Closed;
          closeEmitter.fire(void 0);
        }
      }
      function readErrorHandler(error) {
        errorEmitter.fire([error, void 0, void 0]);
      }
      function writeErrorHandler(data) {
        errorEmitter.fire(data);
      }
      messageReader.onClose(closeHandler);
      messageReader.onError(readErrorHandler);
      messageWriter.onClose(closeHandler);
      messageWriter.onError(writeErrorHandler);
      function triggerMessageQueue() {
        if (timer || messageQueue.size === 0) {
          return;
        }
        timer = (0, ral_1.default)().timer.setImmediate(() => {
          timer = void 0;
          processMessageQueue();
        });
      }
      function handleMessage(message) {
        if (messages_1.Message.isRequest(message)) {
          handleRequest(message);
        } else if (messages_1.Message.isNotification(message)) {
          handleNotification(message);
        } else if (messages_1.Message.isResponse(message)) {
          handleResponse(message);
        } else {
          handleInvalidMessage(message);
        }
      }
      function processMessageQueue() {
        if (messageQueue.size === 0) {
          return;
        }
        const message = messageQueue.shift();
        try {
          const messageStrategy = options?.messageStrategy;
          if (MessageStrategy.is(messageStrategy)) {
            messageStrategy.handleMessage(message, handleMessage);
          } else {
            handleMessage(message);
          }
        } finally {
          triggerMessageQueue();
        }
      }
      const callback = (message) => {
        try {
          if (messages_1.Message.isNotification(message) && message.method === CancelNotification.type.method) {
            const cancelId = message.params.id;
            const key = createRequestQueueKey(cancelId);
            const toCancel = messageQueue.get(key);
            if (messages_1.Message.isRequest(toCancel)) {
              const strategy = options?.connectionStrategy;
              const response = strategy && strategy.cancelUndispatched ? strategy.cancelUndispatched(toCancel, cancelUndispatched) : cancelUndispatched(toCancel);
              if (response && (response.error !== void 0 || response.result !== void 0)) {
                messageQueue.delete(key);
                requestTokens.delete(cancelId);
                response.id = toCancel.id;
                traceSendingResponse(response, message.method, Date.now());
                messageWriter.write(response).catch(() => logger.error(`Sending response for canceled message failed.`));
                return;
              }
            }
            const cancellationToken = requestTokens.get(cancelId);
            if (cancellationToken !== void 0) {
              cancellationToken.cancel();
              traceReceivedNotification(message);
              return;
            } else {
              knownCanceledRequests.add(cancelId);
            }
          }
          addMessageToQueue(messageQueue, message);
        } finally {
          triggerMessageQueue();
        }
      };
      function handleRequest(requestMessage) {
        if (isDisposed()) {
          return;
        }
        function reply(resultOrError, method, startTime2) {
          const message = {
            jsonrpc: version,
            id: requestMessage.id
          };
          if (resultOrError instanceof messages_1.ResponseError) {
            message.error = resultOrError.toJson();
          } else {
            message.result = resultOrError === void 0 ? null : resultOrError;
          }
          traceSendingResponse(message, method, startTime2);
          messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
        }
        function replyError(error, method, startTime2) {
          const message = {
            jsonrpc: version,
            id: requestMessage.id,
            error: error.toJson()
          };
          traceSendingResponse(message, method, startTime2);
          messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
        }
        function replySuccess(result, method, startTime2) {
          if (result === void 0) {
            result = null;
          }
          const message = {
            jsonrpc: version,
            id: requestMessage.id,
            result
          };
          traceSendingResponse(message, method, startTime2);
          messageWriter.write(message).catch(() => logger.error(`Sending response failed.`));
        }
        traceReceivedRequest(requestMessage);
        const element = requestHandlers.get(requestMessage.method);
        let type;
        let requestHandler;
        if (element) {
          type = element.type;
          requestHandler = element.handler;
        }
        const startTime = Date.now();
        if (requestHandler || starRequestHandler) {
          const tokenKey = requestMessage.id ?? String(Date.now());
          const cancellationSource = IdCancellationReceiverStrategy.is(cancellationStrategy.receiver) ? cancellationStrategy.receiver.createCancellationTokenSource(tokenKey) : cancellationStrategy.receiver.createCancellationTokenSource(requestMessage);
          if (requestMessage.id !== null && knownCanceledRequests.has(requestMessage.id)) {
            cancellationSource.cancel();
          }
          if (requestMessage.id !== null) {
            requestTokens.set(tokenKey, cancellationSource);
          }
          try {
            let handlerResult;
            if (requestHandler) {
              if (requestMessage.params === void 0) {
                if (type !== void 0 && type.numberOfParams !== 0) {
                  replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines ${type.numberOfParams} params but received none.`), requestMessage.method, startTime);
                  return;
                }
                handlerResult = requestHandler(cancellationSource.token);
              } else if (Array.isArray(requestMessage.params)) {
                if (type !== void 0 && type.parameterStructures === messages_1.ParameterStructures.byName) {
                  replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines parameters by name but received parameters by position`), requestMessage.method, startTime);
                  return;
                }
                handlerResult = requestHandler(...requestMessage.params, cancellationSource.token);
              } else {
                if (type !== void 0 && type.parameterStructures === messages_1.ParameterStructures.byPosition) {
                  replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InvalidParams, `Request ${requestMessage.method} defines parameters by position but received parameters by name`), requestMessage.method, startTime);
                  return;
                }
                handlerResult = requestHandler(requestMessage.params, cancellationSource.token);
              }
            } else if (starRequestHandler) {
              handlerResult = starRequestHandler(requestMessage.method, requestMessage.params, cancellationSource.token);
            }
            const promise = handlerResult;
            if (!handlerResult) {
              requestTokens.delete(tokenKey);
              replySuccess(handlerResult, requestMessage.method, startTime);
            } else if (promise.then) {
              promise.then((resultOrError) => {
                requestTokens.delete(tokenKey);
                reply(resultOrError, requestMessage.method, startTime);
              }, (error) => {
                requestTokens.delete(tokenKey);
                if (error instanceof messages_1.ResponseError) {
                  replyError(error, requestMessage.method, startTime);
                } else if (error && Is.string(error.message)) {
                  replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
                } else {
                  replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
                }
              });
            } else {
              requestTokens.delete(tokenKey);
              reply(handlerResult, requestMessage.method, startTime);
            }
          } catch (error) {
            requestTokens.delete(tokenKey);
            if (error instanceof messages_1.ResponseError) {
              reply(error, requestMessage.method, startTime);
            } else if (error && Is.string(error.message)) {
              replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed with message: ${error.message}`), requestMessage.method, startTime);
            } else {
              replyError(new messages_1.ResponseError(messages_1.ErrorCodes.InternalError, `Request ${requestMessage.method} failed unexpectedly without providing any details.`), requestMessage.method, startTime);
            }
          }
        } else {
          replyError(new messages_1.ResponseError(messages_1.ErrorCodes.MethodNotFound, `Unhandled method ${requestMessage.method}`), requestMessage.method, startTime);
        }
      }
      function handleResponse(responseMessage) {
        if (isDisposed()) {
          return;
        }
        if (responseMessage.id === null) {
          if (responseMessage.error) {
            logger.error(`Received response message without id: Error is: 
${JSON.stringify(responseMessage.error, void 0, 4)}`);
          } else {
            logger.error(`Received response message without id. No further error information provided.`);
          }
        } else {
          const key = responseMessage.id;
          const responsePromise = responsePromises.get(key);
          traceReceivedResponse(responseMessage, responsePromise);
          if (responsePromise !== void 0) {
            responsePromises.delete(key);
            try {
              if (responseMessage.error) {
                const error = responseMessage.error;
                responsePromise.reject(new messages_1.ResponseError(error.code, error.message, error.data));
              } else if (responseMessage.result !== void 0) {
                responsePromise.resolve(responseMessage.result);
              } else {
                throw new Error("Should never happen.");
              }
            } catch (error) {
              if (error.message) {
                logger.error(`Response handler '${responsePromise.method}' failed with message: ${error.message}`);
              } else {
                logger.error(`Response handler '${responsePromise.method}' failed unexpectedly.`);
              }
            }
          }
        }
      }
      function handleNotification(message) {
        if (isDisposed()) {
          return;
        }
        let type = void 0;
        let notificationHandler;
        if (message.method === CancelNotification.type.method) {
          const cancelId = message.params.id;
          knownCanceledRequests.delete(cancelId);
          traceReceivedNotification(message);
          return;
        } else {
          const element = notificationHandlers.get(message.method);
          if (element) {
            notificationHandler = element.handler;
            type = element.type;
          }
        }
        if (notificationHandler || starNotificationHandler) {
          try {
            traceReceivedNotification(message);
            if (notificationHandler) {
              if (message.params === void 0) {
                if (type !== void 0) {
                  if (type.numberOfParams !== 0 && type.parameterStructures !== messages_1.ParameterStructures.byName) {
                    logger.error(`Notification ${message.method} defines ${type.numberOfParams} params but received none.`);
                  }
                }
                notificationHandler();
              } else if (Array.isArray(message.params)) {
                const params = message.params;
                if (message.method === ProgressNotification.type.method && params.length === 2 && ProgressToken.is(params[0])) {
                  notificationHandler({ token: params[0], value: params[1] });
                } else {
                  if (type !== void 0) {
                    if (type.parameterStructures === messages_1.ParameterStructures.byName) {
                      logger.error(`Notification ${message.method} defines parameters by name but received parameters by position`);
                    }
                    if (type.numberOfParams !== message.params.length) {
                      logger.error(`Notification ${message.method} defines ${type.numberOfParams} params but received ${params.length} arguments`);
                    }
                  }
                  notificationHandler(...params);
                }
              } else {
                if (type !== void 0 && type.parameterStructures === messages_1.ParameterStructures.byPosition) {
                  logger.error(`Notification ${message.method} defines parameters by position but received parameters by name`);
                }
                notificationHandler(message.params);
              }
            } else if (starNotificationHandler) {
              starNotificationHandler(message.method, message.params);
            }
          } catch (error) {
            if (error.message) {
              logger.error(`Notification handler '${message.method}' failed with message: ${error.message}`);
            } else {
              logger.error(`Notification handler '${message.method}' failed unexpectedly.`);
            }
          }
        } else {
          unhandledNotificationEmitter.fire(message);
        }
      }
      function handleInvalidMessage(message) {
        if (!message) {
          logger.error("Received empty message.");
          return;
        }
        logger.error(`Received message which is neither a response nor a notification message:
${JSON.stringify(message, null, 4)}`);
        const responseMessage = message;
        if (Is.string(responseMessage.id) || Is.number(responseMessage.id)) {
          const key = responseMessage.id;
          const responseHandler = responsePromises.get(key);
          if (responseHandler) {
            responseHandler.reject(new Error("The received response has neither a result nor an error property."));
          }
        }
      }
      function stringifyTrace(params) {
        if (params === void 0 || params === null) {
          return void 0;
        }
        switch (trace) {
          case Trace.Verbose:
            return JSON.stringify(params, null, 4);
          case Trace.Compact:
            return JSON.stringify(params);
          default:
            return void 0;
        }
      }
      function traceSendingRequest(message) {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if ((trace === Trace.Verbose || trace === Trace.Compact) && message.params) {
            data = `Params: ${stringifyTrace(message.params)}

`;
          }
          tracer.log(`Sending request '${message.method} - (${message.id})'.`, data);
        } else {
          logLSPMessage("send-request", message);
        }
      }
      function traceSendingNotification(message) {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if (trace === Trace.Verbose || trace === Trace.Compact) {
            if (message.params) {
              data = `Params: ${stringifyTrace(message.params)}

`;
            } else {
              data = "No parameters provided.\n\n";
            }
          }
          tracer.log(`Sending notification '${message.method}'.`, data);
        } else {
          logLSPMessage("send-notification", message);
        }
      }
      function traceSendingResponse(message, method, startTime) {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if (trace === Trace.Verbose || trace === Trace.Compact) {
            if (message.error && message.error.data) {
              data = `Error data: ${stringifyTrace(message.error.data)}

`;
            } else {
              if (message.result) {
                data = `Result: ${stringifyTrace(message.result)}

`;
              } else if (message.error === void 0) {
                data = "No result returned.\n\n";
              }
            }
          }
          tracer.log(`Sending response '${method} - (${message.id})'. Processing request took ${Date.now() - startTime}ms`, data);
        } else {
          logLSPMessage("send-response", message);
        }
      }
      function traceReceivedRequest(message) {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if ((trace === Trace.Verbose || trace === Trace.Compact) && message.params) {
            data = `Params: ${stringifyTrace(message.params)}

`;
          }
          tracer.log(`Received request '${message.method} - (${message.id})'.`, data);
        } else {
          logLSPMessage("receive-request", message);
        }
      }
      function traceReceivedNotification(message) {
        if (trace === Trace.Off || !tracer || message.method === LogTraceNotification.type.method) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if (trace === Trace.Verbose || trace === Trace.Compact) {
            if (message.params) {
              data = `Params: ${stringifyTrace(message.params)}

`;
            } else {
              data = "No parameters provided.\n\n";
            }
          }
          tracer.log(`Received notification '${message.method}'.`, data);
        } else {
          logLSPMessage("receive-notification", message);
        }
      }
      function traceReceivedResponse(message, responsePromise) {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        if (traceFormat === TraceFormat.Text) {
          let data = void 0;
          if (trace === Trace.Verbose || trace === Trace.Compact) {
            if (message.error && message.error.data) {
              data = `Error data: ${stringifyTrace(message.error.data)}

`;
            } else {
              if (message.result) {
                data = `Result: ${stringifyTrace(message.result)}

`;
              } else if (message.error === void 0) {
                data = "No result returned.\n\n";
              }
            }
          }
          if (responsePromise) {
            const error = message.error ? ` Request failed: ${message.error.message} (${message.error.code}).` : "";
            tracer.log(`Received response '${responsePromise.method} - (${message.id})' in ${Date.now() - responsePromise.timerStart}ms.${error}`, data);
          } else {
            tracer.log(`Received response ${message.id} without active response promise.`, data);
          }
        } else {
          logLSPMessage("receive-response", message);
        }
      }
      function logLSPMessage(type, message) {
        if (!tracer || trace === Trace.Off) {
          return;
        }
        const lspMessage = {
          isLSPMessage: true,
          type,
          message,
          timestamp: Date.now()
        };
        tracer.log(lspMessage);
      }
      function throwIfClosedOrDisposed() {
        if (isClosed()) {
          throw new ConnectionError(ConnectionErrors.Closed, "Connection is closed.");
        }
        if (isDisposed()) {
          throw new ConnectionError(ConnectionErrors.Disposed, "Connection is disposed.");
        }
      }
      function throwIfListening() {
        if (isListening()) {
          throw new ConnectionError(ConnectionErrors.AlreadyListening, "Connection is already listening");
        }
      }
      function throwIfNotListening() {
        if (!isListening()) {
          throw new Error("Call listen() first.");
        }
      }
      function undefinedToNull(param) {
        if (param === void 0) {
          return null;
        } else {
          return param;
        }
      }
      function nullToUndefined(param) {
        if (param === null) {
          return void 0;
        } else {
          return param;
        }
      }
      function isNamedParam(param) {
        return param !== void 0 && param !== null && !Array.isArray(param) && typeof param === "object";
      }
      function computeSingleParam(parameterStructures, param) {
        switch (parameterStructures) {
          case messages_1.ParameterStructures.auto:
            if (isNamedParam(param)) {
              return nullToUndefined(param);
            } else {
              return [undefinedToNull(param)];
            }
          case messages_1.ParameterStructures.byName:
            if (!isNamedParam(param)) {
              throw new Error(`Received parameters by name but param is not an object literal.`);
            }
            return nullToUndefined(param);
          case messages_1.ParameterStructures.byPosition:
            return [undefinedToNull(param)];
          default:
            throw new Error(`Unknown parameter structure ${parameterStructures.toString()}`);
        }
      }
      function computeMessageParams(type, params) {
        let result;
        const numberOfParams = type.numberOfParams;
        switch (numberOfParams) {
          case 0:
            result = void 0;
            break;
          case 1:
            result = computeSingleParam(type.parameterStructures, params[0]);
            break;
          default:
            result = [];
            for (let i = 0; i < params.length && i < numberOfParams; i++) {
              result.push(undefinedToNull(params[i]));
            }
            if (params.length < numberOfParams) {
              for (let i = params.length; i < numberOfParams; i++) {
                result.push(null);
              }
            }
            break;
        }
        return result;
      }
      const connection2 = {
        sendNotification: (type, ...args) => {
          throwIfClosedOrDisposed();
          let method;
          let messageParams;
          if (Is.string(type)) {
            method = type;
            const first = args[0];
            let paramStart = 0;
            let parameterStructures = messages_1.ParameterStructures.auto;
            if (messages_1.ParameterStructures.is(first)) {
              paramStart = 1;
              parameterStructures = first;
            }
            let paramEnd = args.length;
            const numberOfParams = paramEnd - paramStart;
            switch (numberOfParams) {
              case 0:
                messageParams = void 0;
                break;
              case 1:
                messageParams = computeSingleParam(parameterStructures, args[paramStart]);
                break;
              default:
                if (parameterStructures === messages_1.ParameterStructures.byName) {
                  throw new Error(`Received ${numberOfParams} parameters for 'by Name' notification parameter structure.`);
                }
                messageParams = args.slice(paramStart, paramEnd).map((value) => undefinedToNull(value));
                break;
            }
          } else {
            const params = args;
            method = type.method;
            messageParams = computeMessageParams(type, params);
          }
          const notificationMessage = {
            jsonrpc: version,
            method,
            params: messageParams
          };
          traceSendingNotification(notificationMessage);
          return messageWriter.write(notificationMessage).catch((error) => {
            logger.error(`Sending notification failed.`);
            throw error;
          });
        },
        onNotification: (type, handler) => {
          throwIfClosedOrDisposed();
          let method;
          if (Is.func(type)) {
            starNotificationHandler = type;
          } else if (handler) {
            if (Is.string(type)) {
              method = type;
              notificationHandlers.set(type, { type: void 0, handler });
            } else {
              method = type.method;
              notificationHandlers.set(type.method, { type, handler });
            }
          }
          return {
            dispose: () => {
              if (method !== void 0) {
                notificationHandlers.delete(method);
              } else {
                starNotificationHandler = void 0;
              }
            }
          };
        },
        onProgress: (_type, token, handler) => {
          if (progressHandlers.has(token)) {
            throw new Error(`Progress handler for token ${token} already registered`);
          }
          progressHandlers.set(token, handler);
          return {
            dispose: () => {
              progressHandlers.delete(token);
            }
          };
        },
        sendProgress: (_type, token, value) => {
          return connection2.sendNotification(ProgressNotification.type, { token, value });
        },
        onUnhandledProgress: unhandledProgressEmitter.event,
        sendRequest: (type, ...args) => {
          throwIfClosedOrDisposed();
          throwIfNotListening();
          let method;
          let messageParams;
          let token = void 0;
          if (Is.string(type)) {
            method = type;
            const first = args[0];
            const last = args[args.length - 1];
            let paramStart = 0;
            let parameterStructures = messages_1.ParameterStructures.auto;
            if (messages_1.ParameterStructures.is(first)) {
              paramStart = 1;
              parameterStructures = first;
            }
            let paramEnd = args.length;
            if (cancellation_1.CancellationToken.is(last)) {
              paramEnd = paramEnd - 1;
              token = last;
            }
            const numberOfParams = paramEnd - paramStart;
            switch (numberOfParams) {
              case 0:
                messageParams = void 0;
                break;
              case 1:
                messageParams = computeSingleParam(parameterStructures, args[paramStart]);
                break;
              default:
                if (parameterStructures === messages_1.ParameterStructures.byName) {
                  throw new Error(`Received ${numberOfParams} parameters for 'by Name' request parameter structure.`);
                }
                messageParams = args.slice(paramStart, paramEnd).map((value) => undefinedToNull(value));
                break;
            }
          } else {
            const params = args;
            method = type.method;
            messageParams = computeMessageParams(type, params);
            const numberOfParams = type.numberOfParams;
            token = cancellation_1.CancellationToken.is(params[numberOfParams]) ? params[numberOfParams] : void 0;
          }
          const id = sequenceNumber++;
          let disposable;
          if (token) {
            disposable = token.onCancellationRequested(() => {
              const p = cancellationStrategy.sender.sendCancellation(connection2, id);
              if (p === void 0) {
                logger.log(`Received no promise from cancellation strategy when cancelling id ${id}`);
                return Promise.resolve();
              } else {
                return p.catch(() => {
                  logger.log(`Sending cancellation messages for id ${id} failed`);
                });
              }
            });
          }
          const requestMessage = {
            jsonrpc: version,
            id,
            method,
            params: messageParams
          };
          traceSendingRequest(requestMessage);
          if (typeof cancellationStrategy.sender.enableCancellation === "function") {
            cancellationStrategy.sender.enableCancellation(requestMessage);
          }
          return new Promise(async (resolve, reject) => {
            const resolveWithCleanup = (r) => {
              resolve(r);
              cancellationStrategy.sender.cleanup(id);
              disposable?.dispose();
            };
            const rejectWithCleanup = (r) => {
              reject(r);
              cancellationStrategy.sender.cleanup(id);
              disposable?.dispose();
            };
            const responsePromise = { method, timerStart: Date.now(), resolve: resolveWithCleanup, reject: rejectWithCleanup };
            try {
              await messageWriter.write(requestMessage);
              responsePromises.set(id, responsePromise);
            } catch (error) {
              logger.error(`Sending request failed.`);
              responsePromise.reject(new messages_1.ResponseError(messages_1.ErrorCodes.MessageWriteError, error.message ? error.message : "Unknown reason"));
              throw error;
            }
          });
        },
        onRequest: (type, handler) => {
          throwIfClosedOrDisposed();
          let method = null;
          if (StarRequestHandler.is(type)) {
            method = void 0;
            starRequestHandler = type;
          } else if (Is.string(type)) {
            method = null;
            if (handler !== void 0) {
              method = type;
              requestHandlers.set(type, { handler, type: void 0 });
            }
          } else {
            if (handler !== void 0) {
              method = type.method;
              requestHandlers.set(type.method, { type, handler });
            }
          }
          return {
            dispose: () => {
              if (method === null) {
                return;
              }
              if (method !== void 0) {
                requestHandlers.delete(method);
              } else {
                starRequestHandler = void 0;
              }
            }
          };
        },
        hasPendingResponse: () => {
          return responsePromises.size > 0;
        },
        trace: async (_value, _tracer, sendNotificationOrTraceOptions) => {
          let _sendNotification = false;
          let _traceFormat = TraceFormat.Text;
          if (sendNotificationOrTraceOptions !== void 0) {
            if (Is.boolean(sendNotificationOrTraceOptions)) {
              _sendNotification = sendNotificationOrTraceOptions;
            } else {
              _sendNotification = sendNotificationOrTraceOptions.sendNotification || false;
              _traceFormat = sendNotificationOrTraceOptions.traceFormat || TraceFormat.Text;
            }
          }
          trace = _value;
          traceFormat = _traceFormat;
          if (trace === Trace.Off) {
            tracer = void 0;
          } else {
            tracer = _tracer;
          }
          if (_sendNotification && !isClosed() && !isDisposed()) {
            await connection2.sendNotification(SetTraceNotification.type, { value: Trace.toString(_value) });
          }
        },
        onError: errorEmitter.event,
        onClose: closeEmitter.event,
        onUnhandledNotification: unhandledNotificationEmitter.event,
        onDispose: disposeEmitter.event,
        end: () => {
          messageWriter.end();
        },
        dispose: () => {
          if (isDisposed()) {
            return;
          }
          state = ConnectionState.Disposed;
          disposeEmitter.fire(void 0);
          const error = new messages_1.ResponseError(messages_1.ErrorCodes.PendingResponseRejected, "Pending response rejected since connection got disposed");
          for (const promise of responsePromises.values()) {
            promise.reject(error);
          }
          responsePromises = /* @__PURE__ */ new Map();
          requestTokens = /* @__PURE__ */ new Map();
          knownCanceledRequests = /* @__PURE__ */ new Set();
          messageQueue = new linkedMap_1.LinkedMap();
          if (Is.func(messageWriter.dispose)) {
            messageWriter.dispose();
          }
          if (Is.func(messageReader.dispose)) {
            messageReader.dispose();
          }
        },
        listen: () => {
          throwIfClosedOrDisposed();
          throwIfListening();
          state = ConnectionState.Listening;
          messageReader.listen(callback);
        },
        inspect: () => {
          (0, ral_1.default)().console.log("inspect");
        }
      };
      connection2.onNotification(LogTraceNotification.type, (params) => {
        if (trace === Trace.Off || !tracer) {
          return;
        }
        const verbose = trace === Trace.Verbose || trace === Trace.Compact;
        tracer.log(params.message, verbose ? params.verbose : void 0);
      });
      connection2.onNotification(ProgressNotification.type, (params) => {
        const handler = progressHandlers.get(params.token);
        if (handler) {
          handler(params.value);
        } else {
          unhandledProgressEmitter.fire(params);
        }
      });
      return connection2;
    }
    exports.createMessageConnection = createMessageConnection;
  }
});

// node_modules/vscode-jsonrpc/lib/common/api.js
var require_api = __commonJS({
  "node_modules/vscode-jsonrpc/lib/common/api.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProgressType = exports.ProgressToken = exports.createMessageConnection = exports.NullLogger = exports.ConnectionOptions = exports.ConnectionStrategy = exports.AbstractMessageBuffer = exports.WriteableStreamMessageWriter = exports.AbstractMessageWriter = exports.MessageWriter = exports.ReadableStreamMessageReader = exports.AbstractMessageReader = exports.MessageReader = exports.SharedArrayReceiverStrategy = exports.SharedArraySenderStrategy = exports.CancellationToken = exports.CancellationTokenSource = exports.Emitter = exports.Event = exports.Disposable = exports.LRUCache = exports.Touch = exports.LinkedMap = exports.ParameterStructures = exports.NotificationType9 = exports.NotificationType8 = exports.NotificationType7 = exports.NotificationType6 = exports.NotificationType5 = exports.NotificationType4 = exports.NotificationType3 = exports.NotificationType2 = exports.NotificationType1 = exports.NotificationType0 = exports.NotificationType = exports.ErrorCodes = exports.ResponseError = exports.RequestType9 = exports.RequestType8 = exports.RequestType7 = exports.RequestType6 = exports.RequestType5 = exports.RequestType4 = exports.RequestType3 = exports.RequestType2 = exports.RequestType1 = exports.RequestType0 = exports.RequestType = exports.Message = exports.RAL = void 0;
    exports.MessageStrategy = exports.CancellationStrategy = exports.CancellationSenderStrategy = exports.CancellationReceiverStrategy = exports.ConnectionError = exports.ConnectionErrors = exports.LogTraceNotification = exports.SetTraceNotification = exports.TraceFormat = exports.TraceValues = exports.Trace = void 0;
    var messages_1 = require_messages();
    Object.defineProperty(exports, "Message", { enumerable: true, get: function() {
      return messages_1.Message;
    } });
    Object.defineProperty(exports, "RequestType", { enumerable: true, get: function() {
      return messages_1.RequestType;
    } });
    Object.defineProperty(exports, "RequestType0", { enumerable: true, get: function() {
      return messages_1.RequestType0;
    } });
    Object.defineProperty(exports, "RequestType1", { enumerable: true, get: function() {
      return messages_1.RequestType1;
    } });
    Object.defineProperty(exports, "RequestType2", { enumerable: true, get: function() {
      return messages_1.RequestType2;
    } });
    Object.defineProperty(exports, "RequestType3", { enumerable: true, get: function() {
      return messages_1.RequestType3;
    } });
    Object.defineProperty(exports, "RequestType4", { enumerable: true, get: function() {
      return messages_1.RequestType4;
    } });
    Object.defineProperty(exports, "RequestType5", { enumerable: true, get: function() {
      return messages_1.RequestType5;
    } });
    Object.defineProperty(exports, "RequestType6", { enumerable: true, get: function() {
      return messages_1.RequestType6;
    } });
    Object.defineProperty(exports, "RequestType7", { enumerable: true, get: function() {
      return messages_1.RequestType7;
    } });
    Object.defineProperty(exports, "RequestType8", { enumerable: true, get: function() {
      return messages_1.RequestType8;
    } });
    Object.defineProperty(exports, "RequestType9", { enumerable: true, get: function() {
      return messages_1.RequestType9;
    } });
    Object.defineProperty(exports, "ResponseError", { enumerable: true, get: function() {
      return messages_1.ResponseError;
    } });
    Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function() {
      return messages_1.ErrorCodes;
    } });
    Object.defineProperty(exports, "NotificationType", { enumerable: true, get: function() {
      return messages_1.NotificationType;
    } });
    Object.defineProperty(exports, "NotificationType0", { enumerable: true, get: function() {
      return messages_1.NotificationType0;
    } });
    Object.defineProperty(exports, "NotificationType1", { enumerable: true, get: function() {
      return messages_1.NotificationType1;
    } });
    Object.defineProperty(exports, "NotificationType2", { enumerable: true, get: function() {
      return messages_1.NotificationType2;
    } });
    Object.defineProperty(exports, "NotificationType3", { enumerable: true, get: function() {
      return messages_1.NotificationType3;
    } });
    Object.defineProperty(exports, "NotificationType4", { enumerable: true, get: function() {
      return messages_1.NotificationType4;
    } });
    Object.defineProperty(exports, "NotificationType5", { enumerable: true, get: function() {
      return messages_1.NotificationType5;
    } });
    Object.defineProperty(exports, "NotificationType6", { enumerable: true, get: function() {
      return messages_1.NotificationType6;
    } });
    Object.defineProperty(exports, "NotificationType7", { enumerable: true, get: function() {
      return messages_1.NotificationType7;
    } });
    Object.defineProperty(exports, "NotificationType8", { enumerable: true, get: function() {
      return messages_1.NotificationType8;
    } });
    Object.defineProperty(exports, "NotificationType9", { enumerable: true, get: function() {
      return messages_1.NotificationType9;
    } });
    Object.defineProperty(exports, "ParameterStructures", { enumerable: true, get: function() {
      return messages_1.ParameterStructures;
    } });
    var linkedMap_1 = require_linkedMap();
    Object.defineProperty(exports, "LinkedMap", { enumerable: true, get: function() {
      return linkedMap_1.LinkedMap;
    } });
    Object.defineProperty(exports, "LRUCache", { enumerable: true, get: function() {
      return linkedMap_1.LRUCache;
    } });
    Object.defineProperty(exports, "Touch", { enumerable: true, get: function() {
      return linkedMap_1.Touch;
    } });
    var disposable_1 = require_disposable();
    Object.defineProperty(exports, "Disposable", { enumerable: true, get: function() {
      return disposable_1.Disposable;
    } });
    var events_1 = require_events();
    Object.defineProperty(exports, "Event", { enumerable: true, get: function() {
      return events_1.Event;
    } });
    Object.defineProperty(exports, "Emitter", { enumerable: true, get: function() {
      return events_1.Emitter;
    } });
    var cancellation_1 = require_cancellation();
    Object.defineProperty(exports, "CancellationTokenSource", { enumerable: true, get: function() {
      return cancellation_1.CancellationTokenSource;
    } });
    Object.defineProperty(exports, "CancellationToken", { enumerable: true, get: function() {
      return cancellation_1.CancellationToken;
    } });
    var sharedArrayCancellation_1 = require_sharedArrayCancellation();
    Object.defineProperty(exports, "SharedArraySenderStrategy", { enumerable: true, get: function() {
      return sharedArrayCancellation_1.SharedArraySenderStrategy;
    } });
    Object.defineProperty(exports, "SharedArrayReceiverStrategy", { enumerable: true, get: function() {
      return sharedArrayCancellation_1.SharedArrayReceiverStrategy;
    } });
    var messageReader_1 = require_messageReader();
    Object.defineProperty(exports, "MessageReader", { enumerable: true, get: function() {
      return messageReader_1.MessageReader;
    } });
    Object.defineProperty(exports, "AbstractMessageReader", { enumerable: true, get: function() {
      return messageReader_1.AbstractMessageReader;
    } });
    Object.defineProperty(exports, "ReadableStreamMessageReader", { enumerable: true, get: function() {
      return messageReader_1.ReadableStreamMessageReader;
    } });
    var messageWriter_1 = require_messageWriter();
    Object.defineProperty(exports, "MessageWriter", { enumerable: true, get: function() {
      return messageWriter_1.MessageWriter;
    } });
    Object.defineProperty(exports, "AbstractMessageWriter", { enumerable: true, get: function() {
      return messageWriter_1.AbstractMessageWriter;
    } });
    Object.defineProperty(exports, "WriteableStreamMessageWriter", { enumerable: true, get: function() {
      return messageWriter_1.WriteableStreamMessageWriter;
    } });
    var messageBuffer_1 = require_messageBuffer();
    Object.defineProperty(exports, "AbstractMessageBuffer", { enumerable: true, get: function() {
      return messageBuffer_1.AbstractMessageBuffer;
    } });
    var connection_1 = require_connection();
    Object.defineProperty(exports, "ConnectionStrategy", { enumerable: true, get: function() {
      return connection_1.ConnectionStrategy;
    } });
    Object.defineProperty(exports, "ConnectionOptions", { enumerable: true, get: function() {
      return connection_1.ConnectionOptions;
    } });
    Object.defineProperty(exports, "NullLogger", { enumerable: true, get: function() {
      return connection_1.NullLogger;
    } });
    Object.defineProperty(exports, "createMessageConnection", { enumerable: true, get: function() {
      return connection_1.createMessageConnection;
    } });
    Object.defineProperty(exports, "ProgressToken", { enumerable: true, get: function() {
      return connection_1.ProgressToken;
    } });
    Object.defineProperty(exports, "ProgressType", { enumerable: true, get: function() {
      return connection_1.ProgressType;
    } });
    Object.defineProperty(exports, "Trace", { enumerable: true, get: function() {
      return connection_1.Trace;
    } });
    Object.defineProperty(exports, "TraceValues", { enumerable: true, get: function() {
      return connection_1.TraceValues;
    } });
    Object.defineProperty(exports, "TraceFormat", { enumerable: true, get: function() {
      return connection_1.TraceFormat;
    } });
    Object.defineProperty(exports, "SetTraceNotification", { enumerable: true, get: function() {
      return connection_1.SetTraceNotification;
    } });
    Object.defineProperty(exports, "LogTraceNotification", { enumerable: true, get: function() {
      return connection_1.LogTraceNotification;
    } });
    Object.defineProperty(exports, "ConnectionErrors", { enumerable: true, get: function() {
      return connection_1.ConnectionErrors;
    } });
    Object.defineProperty(exports, "ConnectionError", { enumerable: true, get: function() {
      return connection_1.ConnectionError;
    } });
    Object.defineProperty(exports, "CancellationReceiverStrategy", { enumerable: true, get: function() {
      return connection_1.CancellationReceiverStrategy;
    } });
    Object.defineProperty(exports, "CancellationSenderStrategy", { enumerable: true, get: function() {
      return connection_1.CancellationSenderStrategy;
    } });
    Object.defineProperty(exports, "CancellationStrategy", { enumerable: true, get: function() {
      return connection_1.CancellationStrategy;
    } });
    Object.defineProperty(exports, "MessageStrategy", { enumerable: true, get: function() {
      return connection_1.MessageStrategy;
    } });
    var ral_1 = require_ral();
    exports.RAL = ral_1.default;
  }
});

// node_modules/vscode-jsonrpc/lib/node/ril.js
var require_ril = __commonJS({
  "node_modules/vscode-jsonrpc/lib/node/ril.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = __require("util");
    var api_1 = require_api();
    var MessageBuffer = class _MessageBuffer extends api_1.AbstractMessageBuffer {
      constructor(encoding = "utf-8") {
        super(encoding);
      }
      emptyBuffer() {
        return _MessageBuffer.emptyBuffer;
      }
      fromString(value, encoding) {
        return Buffer.from(value, encoding);
      }
      toString(value, encoding) {
        if (value instanceof Buffer) {
          return value.toString(encoding);
        } else {
          return new util_1.TextDecoder(encoding).decode(value);
        }
      }
      asNative(buffer, length) {
        if (length === void 0) {
          return buffer instanceof Buffer ? buffer : Buffer.from(buffer);
        } else {
          return buffer instanceof Buffer ? buffer.slice(0, length) : Buffer.from(buffer, 0, length);
        }
      }
      allocNative(length) {
        return Buffer.allocUnsafe(length);
      }
    };
    MessageBuffer.emptyBuffer = Buffer.allocUnsafe(0);
    var ReadableStreamWrapper = class {
      constructor(stream) {
        this.stream = stream;
      }
      onClose(listener) {
        this.stream.on("close", listener);
        return api_1.Disposable.create(() => this.stream.off("close", listener));
      }
      onError(listener) {
        this.stream.on("error", listener);
        return api_1.Disposable.create(() => this.stream.off("error", listener));
      }
      onEnd(listener) {
        this.stream.on("end", listener);
        return api_1.Disposable.create(() => this.stream.off("end", listener));
      }
      onData(listener) {
        this.stream.on("data", listener);
        return api_1.Disposable.create(() => this.stream.off("data", listener));
      }
    };
    var WritableStreamWrapper = class {
      constructor(stream) {
        this.stream = stream;
      }
      onClose(listener) {
        this.stream.on("close", listener);
        return api_1.Disposable.create(() => this.stream.off("close", listener));
      }
      onError(listener) {
        this.stream.on("error", listener);
        return api_1.Disposable.create(() => this.stream.off("error", listener));
      }
      onEnd(listener) {
        this.stream.on("end", listener);
        return api_1.Disposable.create(() => this.stream.off("end", listener));
      }
      write(data, encoding) {
        return new Promise((resolve, reject) => {
          const callback = (error) => {
            if (error === void 0 || error === null) {
              resolve();
            } else {
              reject(error);
            }
          };
          if (typeof data === "string") {
            this.stream.write(data, encoding, callback);
          } else {
            this.stream.write(data, callback);
          }
        });
      }
      end() {
        this.stream.end();
      }
    };
    var _ril = Object.freeze({
      messageBuffer: Object.freeze({
        create: (encoding) => new MessageBuffer(encoding)
      }),
      applicationJson: Object.freeze({
        encoder: Object.freeze({
          name: "application/json",
          encode: (msg, options) => {
            try {
              return Promise.resolve(Buffer.from(JSON.stringify(msg, void 0, 0), options.charset));
            } catch (err) {
              return Promise.reject(err);
            }
          }
        }),
        decoder: Object.freeze({
          name: "application/json",
          decode: (buffer, options) => {
            try {
              if (buffer instanceof Buffer) {
                return Promise.resolve(JSON.parse(buffer.toString(options.charset)));
              } else {
                return Promise.resolve(JSON.parse(new util_1.TextDecoder(options.charset).decode(buffer)));
              }
            } catch (err) {
              return Promise.reject(err);
            }
          }
        })
      }),
      stream: Object.freeze({
        asReadableStream: (stream) => new ReadableStreamWrapper(stream),
        asWritableStream: (stream) => new WritableStreamWrapper(stream)
      }),
      console,
      timer: Object.freeze({
        setTimeout(callback, ms, ...args) {
          const handle = setTimeout(callback, ms, ...args);
          return { dispose: () => clearTimeout(handle) };
        },
        setImmediate(callback, ...args) {
          const handle = setImmediate(callback, ...args);
          return { dispose: () => clearImmediate(handle) };
        },
        setInterval(callback, ms, ...args) {
          const handle = setInterval(callback, ms, ...args);
          return { dispose: () => clearInterval(handle) };
        }
      })
    });
    function RIL() {
      return _ril;
    }
    (function(RIL2) {
      function install() {
        api_1.RAL.install(_ril);
      }
      RIL2.install = install;
    })(RIL || (RIL = {}));
    exports.default = RIL;
  }
});

// node_modules/vscode-jsonrpc/lib/node/main.js
var require_main = __commonJS({
  "node_modules/vscode-jsonrpc/lib/node/main.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createMessageConnection = exports.createServerSocketTransport = exports.createClientSocketTransport = exports.createServerPipeTransport = exports.createClientPipeTransport = exports.generateRandomPipeName = exports.StreamMessageWriter = exports.StreamMessageReader = exports.SocketMessageWriter = exports.SocketMessageReader = exports.PortMessageWriter = exports.PortMessageReader = exports.IPCMessageWriter = exports.IPCMessageReader = void 0;
    var ril_1 = require_ril();
    ril_1.default.install();
    var path6 = __require("path");
    var os = __require("os");
    var crypto_1 = __require("crypto");
    var net_1 = __require("net");
    var api_1 = require_api();
    __exportStar(require_api(), exports);
    var IPCMessageReader = class extends api_1.AbstractMessageReader {
      constructor(process2) {
        super();
        this.process = process2;
        let eventEmitter = this.process;
        eventEmitter.on("error", (error) => this.fireError(error));
        eventEmitter.on("close", () => this.fireClose());
      }
      listen(callback) {
        this.process.on("message", callback);
        return api_1.Disposable.create(() => this.process.off("message", callback));
      }
    };
    exports.IPCMessageReader = IPCMessageReader;
    var IPCMessageWriter = class extends api_1.AbstractMessageWriter {
      constructor(process2) {
        super();
        this.process = process2;
        this.errorCount = 0;
        const eventEmitter = this.process;
        eventEmitter.on("error", (error) => this.fireError(error));
        eventEmitter.on("close", () => this.fireClose);
      }
      write(msg) {
        try {
          if (typeof this.process.send === "function") {
            this.process.send(msg, void 0, void 0, (error) => {
              if (error) {
                this.errorCount++;
                this.handleError(error, msg);
              } else {
                this.errorCount = 0;
              }
            });
          }
          return Promise.resolve();
        } catch (error) {
          this.handleError(error, msg);
          return Promise.reject(error);
        }
      }
      handleError(error, msg) {
        this.errorCount++;
        this.fireError(error, msg, this.errorCount);
      }
      end() {
      }
    };
    exports.IPCMessageWriter = IPCMessageWriter;
    var PortMessageReader = class extends api_1.AbstractMessageReader {
      constructor(port) {
        super();
        this.onData = new api_1.Emitter();
        port.on("close", () => this.fireClose);
        port.on("error", (error) => this.fireError(error));
        port.on("message", (message) => {
          this.onData.fire(message);
        });
      }
      listen(callback) {
        return this.onData.event(callback);
      }
    };
    exports.PortMessageReader = PortMessageReader;
    var PortMessageWriter = class extends api_1.AbstractMessageWriter {
      constructor(port) {
        super();
        this.port = port;
        this.errorCount = 0;
        port.on("close", () => this.fireClose());
        port.on("error", (error) => this.fireError(error));
      }
      write(msg) {
        try {
          this.port.postMessage(msg);
          return Promise.resolve();
        } catch (error) {
          this.handleError(error, msg);
          return Promise.reject(error);
        }
      }
      handleError(error, msg) {
        this.errorCount++;
        this.fireError(error, msg, this.errorCount);
      }
      end() {
      }
    };
    exports.PortMessageWriter = PortMessageWriter;
    var SocketMessageReader = class extends api_1.ReadableStreamMessageReader {
      constructor(socket, encoding = "utf-8") {
        super((0, ril_1.default)().stream.asReadableStream(socket), encoding);
      }
    };
    exports.SocketMessageReader = SocketMessageReader;
    var SocketMessageWriter = class extends api_1.WriteableStreamMessageWriter {
      constructor(socket, options) {
        super((0, ril_1.default)().stream.asWritableStream(socket), options);
        this.socket = socket;
      }
      dispose() {
        super.dispose();
        this.socket.destroy();
      }
    };
    exports.SocketMessageWriter = SocketMessageWriter;
    var StreamMessageReader = class extends api_1.ReadableStreamMessageReader {
      constructor(readable, encoding) {
        super((0, ril_1.default)().stream.asReadableStream(readable), encoding);
      }
    };
    exports.StreamMessageReader = StreamMessageReader;
    var StreamMessageWriter = class extends api_1.WriteableStreamMessageWriter {
      constructor(writable, options) {
        super((0, ril_1.default)().stream.asWritableStream(writable), options);
      }
    };
    exports.StreamMessageWriter = StreamMessageWriter;
    var XDG_RUNTIME_DIR = process.env["XDG_RUNTIME_DIR"];
    var safeIpcPathLengths = /* @__PURE__ */ new Map([
      ["linux", 107],
      ["darwin", 103]
    ]);
    function generateRandomPipeName() {
      const randomSuffix = (0, crypto_1.randomBytes)(21).toString("hex");
      if (process.platform === "win32") {
        return `\\\\.\\pipe\\vscode-jsonrpc-${randomSuffix}-sock`;
      }
      let result;
      if (XDG_RUNTIME_DIR) {
        result = path6.join(XDG_RUNTIME_DIR, `vscode-ipc-${randomSuffix}.sock`);
      } else {
        result = path6.join(os.tmpdir(), `vscode-${randomSuffix}.sock`);
      }
      const limit = safeIpcPathLengths.get(process.platform);
      if (limit !== void 0 && result.length > limit) {
        (0, ril_1.default)().console.warn(`WARNING: IPC handle "${result}" is longer than ${limit} characters.`);
      }
      return result;
    }
    exports.generateRandomPipeName = generateRandomPipeName;
    function createClientPipeTransport(pipeName, encoding = "utf-8") {
      let connectResolve;
      const connected = new Promise((resolve, _reject) => {
        connectResolve = resolve;
      });
      return new Promise((resolve, reject) => {
        let server = (0, net_1.createServer)((socket) => {
          server.close();
          connectResolve([
            new SocketMessageReader(socket, encoding),
            new SocketMessageWriter(socket, encoding)
          ]);
        });
        server.on("error", reject);
        server.listen(pipeName, () => {
          server.removeListener("error", reject);
          resolve({
            onConnected: () => {
              return connected;
            }
          });
        });
      });
    }
    exports.createClientPipeTransport = createClientPipeTransport;
    function createServerPipeTransport(pipeName, encoding = "utf-8") {
      const socket = (0, net_1.createConnection)(pipeName);
      return [
        new SocketMessageReader(socket, encoding),
        new SocketMessageWriter(socket, encoding)
      ];
    }
    exports.createServerPipeTransport = createServerPipeTransport;
    function createClientSocketTransport(port, encoding = "utf-8") {
      let connectResolve;
      const connected = new Promise((resolve, _reject) => {
        connectResolve = resolve;
      });
      return new Promise((resolve, reject) => {
        const server = (0, net_1.createServer)((socket) => {
          server.close();
          connectResolve([
            new SocketMessageReader(socket, encoding),
            new SocketMessageWriter(socket, encoding)
          ]);
        });
        server.on("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve({
            onConnected: () => {
              return connected;
            }
          });
        });
      });
    }
    exports.createClientSocketTransport = createClientSocketTransport;
    function createServerSocketTransport(port, encoding = "utf-8") {
      const socket = (0, net_1.createConnection)(port, "127.0.0.1");
      return [
        new SocketMessageReader(socket, encoding),
        new SocketMessageWriter(socket, encoding)
      ];
    }
    exports.createServerSocketTransport = createServerSocketTransport;
    function isReadableStream(value) {
      const candidate = value;
      return candidate.read !== void 0 && candidate.addListener !== void 0;
    }
    function isWritableStream(value) {
      const candidate = value;
      return candidate.write !== void 0 && candidate.addListener !== void 0;
    }
    function createMessageConnection(input, output, logger, options) {
      if (!logger) {
        logger = api_1.NullLogger;
      }
      const reader = isReadableStream(input) ? new StreamMessageReader(input) : input;
      const writer = isWritableStream(output) ? new StreamMessageWriter(output) : output;
      if (api_1.ConnectionStrategy.is(options)) {
        options = { connectionStrategy: options };
      }
      return (0, api_1.createMessageConnection)(reader, writer, logger, options);
    }
    exports.createMessageConnection = createMessageConnection;
  }
});

// node_modules/vscode-jsonrpc/node.js
var require_node = __commonJS({
  "node_modules/vscode-jsonrpc/node.js"(exports, module) {
    "use strict";
    module.exports = require_main();
  }
});

// node_modules/vscode-languageserver-types/lib/umd/main.js
var require_main2 = __commonJS({
  "node_modules/vscode-languageserver-types/lib/umd/main.js"(exports, module) {
    (function(factory) {
      if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(__require, exports);
        if (v !== void 0) module.exports = v;
      } else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
      }
    })(function(require2, exports2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      exports2.TextDocument = exports2.EOL = exports2.WorkspaceFolder = exports2.InlineCompletionContext = exports2.SelectedCompletionInfo = exports2.InlineCompletionTriggerKind = exports2.InlineCompletionList = exports2.InlineCompletionItem = exports2.StringValue = exports2.InlayHint = exports2.InlayHintLabelPart = exports2.InlayHintKind = exports2.InlineValueContext = exports2.InlineValueEvaluatableExpression = exports2.InlineValueVariableLookup = exports2.InlineValueText = exports2.SemanticTokens = exports2.SemanticTokenModifiers = exports2.SemanticTokenTypes = exports2.SelectionRange = exports2.DocumentLink = exports2.FormattingOptions = exports2.CodeLens = exports2.CodeAction = exports2.CodeActionContext = exports2.CodeActionTriggerKind = exports2.CodeActionKind = exports2.DocumentSymbol = exports2.WorkspaceSymbol = exports2.SymbolInformation = exports2.SymbolTag = exports2.SymbolKind = exports2.DocumentHighlight = exports2.DocumentHighlightKind = exports2.SignatureInformation = exports2.ParameterInformation = exports2.Hover = exports2.MarkedString = exports2.CompletionList = exports2.CompletionItem = exports2.CompletionItemLabelDetails = exports2.InsertTextMode = exports2.InsertReplaceEdit = exports2.CompletionItemTag = exports2.InsertTextFormat = exports2.CompletionItemKind = exports2.MarkupContent = exports2.MarkupKind = exports2.TextDocumentItem = exports2.OptionalVersionedTextDocumentIdentifier = exports2.VersionedTextDocumentIdentifier = exports2.TextDocumentIdentifier = exports2.WorkspaceChange = exports2.WorkspaceEdit = exports2.DeleteFile = exports2.RenameFile = exports2.CreateFile = exports2.TextDocumentEdit = exports2.AnnotatedTextEdit = exports2.ChangeAnnotationIdentifier = exports2.ChangeAnnotation = exports2.TextEdit = exports2.Command = exports2.Diagnostic = exports2.CodeDescription = exports2.DiagnosticTag = exports2.DiagnosticSeverity = exports2.DiagnosticRelatedInformation = exports2.FoldingRange = exports2.FoldingRangeKind = exports2.ColorPresentation = exports2.ColorInformation = exports2.Color = exports2.LocationLink = exports2.Location = exports2.Range = exports2.Position = exports2.uinteger = exports2.integer = exports2.URI = exports2.DocumentUri = void 0;
      var DocumentUri;
      (function(DocumentUri2) {
        function is(value) {
          return typeof value === "string";
        }
        DocumentUri2.is = is;
      })(DocumentUri || (exports2.DocumentUri = DocumentUri = {}));
      var URI;
      (function(URI2) {
        function is(value) {
          return typeof value === "string";
        }
        URI2.is = is;
      })(URI || (exports2.URI = URI = {}));
      var integer;
      (function(integer2) {
        integer2.MIN_VALUE = -2147483648;
        integer2.MAX_VALUE = 2147483647;
        function is(value) {
          return typeof value === "number" && integer2.MIN_VALUE <= value && value <= integer2.MAX_VALUE;
        }
        integer2.is = is;
      })(integer || (exports2.integer = integer = {}));
      var uinteger;
      (function(uinteger2) {
        uinteger2.MIN_VALUE = 0;
        uinteger2.MAX_VALUE = 2147483647;
        function is(value) {
          return typeof value === "number" && uinteger2.MIN_VALUE <= value && value <= uinteger2.MAX_VALUE;
        }
        uinteger2.is = is;
      })(uinteger || (exports2.uinteger = uinteger = {}));
      var Position2;
      (function(Position3) {
        function create(line, character) {
          if (line === Number.MAX_VALUE) {
            line = uinteger.MAX_VALUE;
          }
          if (character === Number.MAX_VALUE) {
            character = uinteger.MAX_VALUE;
          }
          return { line, character };
        }
        Position3.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.uinteger(candidate.line) && Is.uinteger(candidate.character);
        }
        Position3.is = is;
      })(Position2 || (exports2.Position = Position2 = {}));
      var Range2;
      (function(Range3) {
        function create(one, two, three, four) {
          if (Is.uinteger(one) && Is.uinteger(two) && Is.uinteger(three) && Is.uinteger(four)) {
            return { start: Position2.create(one, two), end: Position2.create(three, four) };
          } else if (Position2.is(one) && Position2.is(two)) {
            return { start: one, end: two };
          } else {
            throw new Error("Range#create called with invalid arguments[".concat(one, ", ").concat(two, ", ").concat(three, ", ").concat(four, "]"));
          }
        }
        Range3.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Position2.is(candidate.start) && Position2.is(candidate.end);
        }
        Range3.is = is;
      })(Range2 || (exports2.Range = Range2 = {}));
      var Location2;
      (function(Location3) {
        function create(uri, range) {
          return { uri, range };
        }
        Location3.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Range2.is(candidate.range) && (Is.string(candidate.uri) || Is.undefined(candidate.uri));
        }
        Location3.is = is;
      })(Location2 || (exports2.Location = Location2 = {}));
      var LocationLink;
      (function(LocationLink2) {
        function create(targetUri, targetRange, targetSelectionRange, originSelectionRange) {
          return { targetUri, targetRange, targetSelectionRange, originSelectionRange };
        }
        LocationLink2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Range2.is(candidate.targetRange) && Is.string(candidate.targetUri) && Range2.is(candidate.targetSelectionRange) && (Range2.is(candidate.originSelectionRange) || Is.undefined(candidate.originSelectionRange));
        }
        LocationLink2.is = is;
      })(LocationLink || (exports2.LocationLink = LocationLink = {}));
      var Color;
      (function(Color2) {
        function create(red, green, blue, alpha) {
          return {
            red,
            green,
            blue,
            alpha
          };
        }
        Color2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.numberRange(candidate.red, 0, 1) && Is.numberRange(candidate.green, 0, 1) && Is.numberRange(candidate.blue, 0, 1) && Is.numberRange(candidate.alpha, 0, 1);
        }
        Color2.is = is;
      })(Color || (exports2.Color = Color = {}));
      var ColorInformation;
      (function(ColorInformation2) {
        function create(range, color) {
          return {
            range,
            color
          };
        }
        ColorInformation2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Range2.is(candidate.range) && Color.is(candidate.color);
        }
        ColorInformation2.is = is;
      })(ColorInformation || (exports2.ColorInformation = ColorInformation = {}));
      var ColorPresentation;
      (function(ColorPresentation2) {
        function create(label, textEdit, additionalTextEdits) {
          return {
            label,
            textEdit,
            additionalTextEdits
          };
        }
        ColorPresentation2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.string(candidate.label) && (Is.undefined(candidate.textEdit) || TextEdit2.is(candidate)) && (Is.undefined(candidate.additionalTextEdits) || Is.typedArray(candidate.additionalTextEdits, TextEdit2.is));
        }
        ColorPresentation2.is = is;
      })(ColorPresentation || (exports2.ColorPresentation = ColorPresentation = {}));
      var FoldingRangeKind;
      (function(FoldingRangeKind2) {
        FoldingRangeKind2.Comment = "comment";
        FoldingRangeKind2.Imports = "imports";
        FoldingRangeKind2.Region = "region";
      })(FoldingRangeKind || (exports2.FoldingRangeKind = FoldingRangeKind = {}));
      var FoldingRange;
      (function(FoldingRange2) {
        function create(startLine, endLine, startCharacter, endCharacter, kind, collapsedText) {
          var result = {
            startLine,
            endLine
          };
          if (Is.defined(startCharacter)) {
            result.startCharacter = startCharacter;
          }
          if (Is.defined(endCharacter)) {
            result.endCharacter = endCharacter;
          }
          if (Is.defined(kind)) {
            result.kind = kind;
          }
          if (Is.defined(collapsedText)) {
            result.collapsedText = collapsedText;
          }
          return result;
        }
        FoldingRange2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.uinteger(candidate.startLine) && Is.uinteger(candidate.startLine) && (Is.undefined(candidate.startCharacter) || Is.uinteger(candidate.startCharacter)) && (Is.undefined(candidate.endCharacter) || Is.uinteger(candidate.endCharacter)) && (Is.undefined(candidate.kind) || Is.string(candidate.kind));
        }
        FoldingRange2.is = is;
      })(FoldingRange || (exports2.FoldingRange = FoldingRange = {}));
      var DiagnosticRelatedInformation;
      (function(DiagnosticRelatedInformation2) {
        function create(location, message) {
          return {
            location,
            message
          };
        }
        DiagnosticRelatedInformation2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Location2.is(candidate.location) && Is.string(candidate.message);
        }
        DiagnosticRelatedInformation2.is = is;
      })(DiagnosticRelatedInformation || (exports2.DiagnosticRelatedInformation = DiagnosticRelatedInformation = {}));
      var DiagnosticSeverity2;
      (function(DiagnosticSeverity3) {
        DiagnosticSeverity3.Error = 1;
        DiagnosticSeverity3.Warning = 2;
        DiagnosticSeverity3.Information = 3;
        DiagnosticSeverity3.Hint = 4;
      })(DiagnosticSeverity2 || (exports2.DiagnosticSeverity = DiagnosticSeverity2 = {}));
      var DiagnosticTag;
      (function(DiagnosticTag2) {
        DiagnosticTag2.Unnecessary = 1;
        DiagnosticTag2.Deprecated = 2;
      })(DiagnosticTag || (exports2.DiagnosticTag = DiagnosticTag = {}));
      var CodeDescription;
      (function(CodeDescription2) {
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.string(candidate.href);
        }
        CodeDescription2.is = is;
      })(CodeDescription || (exports2.CodeDescription = CodeDescription = {}));
      var Diagnostic2;
      (function(Diagnostic3) {
        function create(range, message, severity, code, source, relatedInformation) {
          var result = { range, message };
          if (Is.defined(severity)) {
            result.severity = severity;
          }
          if (Is.defined(code)) {
            result.code = code;
          }
          if (Is.defined(source)) {
            result.source = source;
          }
          if (Is.defined(relatedInformation)) {
            result.relatedInformation = relatedInformation;
          }
          return result;
        }
        Diagnostic3.create = create;
        function is(value) {
          var _a;
          var candidate = value;
          return Is.defined(candidate) && Range2.is(candidate.range) && Is.string(candidate.message) && (Is.number(candidate.severity) || Is.undefined(candidate.severity)) && (Is.integer(candidate.code) || Is.string(candidate.code) || Is.undefined(candidate.code)) && (Is.undefined(candidate.codeDescription) || Is.string((_a = candidate.codeDescription) === null || _a === void 0 ? void 0 : _a.href)) && (Is.string(candidate.source) || Is.undefined(candidate.source)) && (Is.undefined(candidate.relatedInformation) || Is.typedArray(candidate.relatedInformation, DiagnosticRelatedInformation.is));
        }
        Diagnostic3.is = is;
      })(Diagnostic2 || (exports2.Diagnostic = Diagnostic2 = {}));
      var Command;
      (function(Command2) {
        function create(title, command) {
          var args = [];
          for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
          }
          var result = { title, command };
          if (Is.defined(args) && args.length > 0) {
            result.arguments = args;
          }
          return result;
        }
        Command2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.title) && Is.string(candidate.command);
        }
        Command2.is = is;
      })(Command || (exports2.Command = Command = {}));
      var TextEdit2;
      (function(TextEdit3) {
        function replace(range, newText) {
          return { range, newText };
        }
        TextEdit3.replace = replace;
        function insert(position, newText) {
          return { range: { start: position, end: position }, newText };
        }
        TextEdit3.insert = insert;
        function del(range) {
          return { range, newText: "" };
        }
        TextEdit3.del = del;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.string(candidate.newText) && Range2.is(candidate.range);
        }
        TextEdit3.is = is;
      })(TextEdit2 || (exports2.TextEdit = TextEdit2 = {}));
      var ChangeAnnotation;
      (function(ChangeAnnotation2) {
        function create(label, needsConfirmation, description) {
          var result = { label };
          if (needsConfirmation !== void 0) {
            result.needsConfirmation = needsConfirmation;
          }
          if (description !== void 0) {
            result.description = description;
          }
          return result;
        }
        ChangeAnnotation2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Is.string(candidate.label) && (Is.boolean(candidate.needsConfirmation) || candidate.needsConfirmation === void 0) && (Is.string(candidate.description) || candidate.description === void 0);
        }
        ChangeAnnotation2.is = is;
      })(ChangeAnnotation || (exports2.ChangeAnnotation = ChangeAnnotation = {}));
      var ChangeAnnotationIdentifier;
      (function(ChangeAnnotationIdentifier2) {
        function is(value) {
          var candidate = value;
          return Is.string(candidate);
        }
        ChangeAnnotationIdentifier2.is = is;
      })(ChangeAnnotationIdentifier || (exports2.ChangeAnnotationIdentifier = ChangeAnnotationIdentifier = {}));
      var AnnotatedTextEdit;
      (function(AnnotatedTextEdit2) {
        function replace(range, newText, annotation) {
          return { range, newText, annotationId: annotation };
        }
        AnnotatedTextEdit2.replace = replace;
        function insert(position, newText, annotation) {
          return { range: { start: position, end: position }, newText, annotationId: annotation };
        }
        AnnotatedTextEdit2.insert = insert;
        function del(range, annotation) {
          return { range, newText: "", annotationId: annotation };
        }
        AnnotatedTextEdit2.del = del;
        function is(value) {
          var candidate = value;
          return TextEdit2.is(candidate) && (ChangeAnnotation.is(candidate.annotationId) || ChangeAnnotationIdentifier.is(candidate.annotationId));
        }
        AnnotatedTextEdit2.is = is;
      })(AnnotatedTextEdit || (exports2.AnnotatedTextEdit = AnnotatedTextEdit = {}));
      var TextDocumentEdit;
      (function(TextDocumentEdit2) {
        function create(textDocument, edits) {
          return { textDocument, edits };
        }
        TextDocumentEdit2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && OptionalVersionedTextDocumentIdentifier.is(candidate.textDocument) && Array.isArray(candidate.edits);
        }
        TextDocumentEdit2.is = is;
      })(TextDocumentEdit || (exports2.TextDocumentEdit = TextDocumentEdit = {}));
      var CreateFile;
      (function(CreateFile2) {
        function create(uri, options, annotation) {
          var result = {
            kind: "create",
            uri
          };
          if (options !== void 0 && (options.overwrite !== void 0 || options.ignoreIfExists !== void 0)) {
            result.options = options;
          }
          if (annotation !== void 0) {
            result.annotationId = annotation;
          }
          return result;
        }
        CreateFile2.create = create;
        function is(value) {
          var candidate = value;
          return candidate && candidate.kind === "create" && Is.string(candidate.uri) && (candidate.options === void 0 || (candidate.options.overwrite === void 0 || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === void 0 || Is.boolean(candidate.options.ignoreIfExists))) && (candidate.annotationId === void 0 || ChangeAnnotationIdentifier.is(candidate.annotationId));
        }
        CreateFile2.is = is;
      })(CreateFile || (exports2.CreateFile = CreateFile = {}));
      var RenameFile;
      (function(RenameFile2) {
        function create(oldUri, newUri, options, annotation) {
          var result = {
            kind: "rename",
            oldUri,
            newUri
          };
          if (options !== void 0 && (options.overwrite !== void 0 || options.ignoreIfExists !== void 0)) {
            result.options = options;
          }
          if (annotation !== void 0) {
            result.annotationId = annotation;
          }
          return result;
        }
        RenameFile2.create = create;
        function is(value) {
          var candidate = value;
          return candidate && candidate.kind === "rename" && Is.string(candidate.oldUri) && Is.string(candidate.newUri) && (candidate.options === void 0 || (candidate.options.overwrite === void 0 || Is.boolean(candidate.options.overwrite)) && (candidate.options.ignoreIfExists === void 0 || Is.boolean(candidate.options.ignoreIfExists))) && (candidate.annotationId === void 0 || ChangeAnnotationIdentifier.is(candidate.annotationId));
        }
        RenameFile2.is = is;
      })(RenameFile || (exports2.RenameFile = RenameFile = {}));
      var DeleteFile;
      (function(DeleteFile2) {
        function create(uri, options, annotation) {
          var result = {
            kind: "delete",
            uri
          };
          if (options !== void 0 && (options.recursive !== void 0 || options.ignoreIfNotExists !== void 0)) {
            result.options = options;
          }
          if (annotation !== void 0) {
            result.annotationId = annotation;
          }
          return result;
        }
        DeleteFile2.create = create;
        function is(value) {
          var candidate = value;
          return candidate && candidate.kind === "delete" && Is.string(candidate.uri) && (candidate.options === void 0 || (candidate.options.recursive === void 0 || Is.boolean(candidate.options.recursive)) && (candidate.options.ignoreIfNotExists === void 0 || Is.boolean(candidate.options.ignoreIfNotExists))) && (candidate.annotationId === void 0 || ChangeAnnotationIdentifier.is(candidate.annotationId));
        }
        DeleteFile2.is = is;
      })(DeleteFile || (exports2.DeleteFile = DeleteFile = {}));
      var WorkspaceEdit2;
      (function(WorkspaceEdit3) {
        function is(value) {
          var candidate = value;
          return candidate && (candidate.changes !== void 0 || candidate.documentChanges !== void 0) && (candidate.documentChanges === void 0 || candidate.documentChanges.every(function(change) {
            if (Is.string(change.kind)) {
              return CreateFile.is(change) || RenameFile.is(change) || DeleteFile.is(change);
            } else {
              return TextDocumentEdit.is(change);
            }
          }));
        }
        WorkspaceEdit3.is = is;
      })(WorkspaceEdit2 || (exports2.WorkspaceEdit = WorkspaceEdit2 = {}));
      var TextEditChangeImpl = (
        /** @class */
        (function() {
          function TextEditChangeImpl2(edits, changeAnnotations) {
            this.edits = edits;
            this.changeAnnotations = changeAnnotations;
          }
          TextEditChangeImpl2.prototype.insert = function(position, newText, annotation) {
            var edit;
            var id;
            if (annotation === void 0) {
              edit = TextEdit2.insert(position, newText);
            } else if (ChangeAnnotationIdentifier.is(annotation)) {
              id = annotation;
              edit = AnnotatedTextEdit.insert(position, newText, annotation);
            } else {
              this.assertChangeAnnotations(this.changeAnnotations);
              id = this.changeAnnotations.manage(annotation);
              edit = AnnotatedTextEdit.insert(position, newText, id);
            }
            this.edits.push(edit);
            if (id !== void 0) {
              return id;
            }
          };
          TextEditChangeImpl2.prototype.replace = function(range, newText, annotation) {
            var edit;
            var id;
            if (annotation === void 0) {
              edit = TextEdit2.replace(range, newText);
            } else if (ChangeAnnotationIdentifier.is(annotation)) {
              id = annotation;
              edit = AnnotatedTextEdit.replace(range, newText, annotation);
            } else {
              this.assertChangeAnnotations(this.changeAnnotations);
              id = this.changeAnnotations.manage(annotation);
              edit = AnnotatedTextEdit.replace(range, newText, id);
            }
            this.edits.push(edit);
            if (id !== void 0) {
              return id;
            }
          };
          TextEditChangeImpl2.prototype.delete = function(range, annotation) {
            var edit;
            var id;
            if (annotation === void 0) {
              edit = TextEdit2.del(range);
            } else if (ChangeAnnotationIdentifier.is(annotation)) {
              id = annotation;
              edit = AnnotatedTextEdit.del(range, annotation);
            } else {
              this.assertChangeAnnotations(this.changeAnnotations);
              id = this.changeAnnotations.manage(annotation);
              edit = AnnotatedTextEdit.del(range, id);
            }
            this.edits.push(edit);
            if (id !== void 0) {
              return id;
            }
          };
          TextEditChangeImpl2.prototype.add = function(edit) {
            this.edits.push(edit);
          };
          TextEditChangeImpl2.prototype.all = function() {
            return this.edits;
          };
          TextEditChangeImpl2.prototype.clear = function() {
            this.edits.splice(0, this.edits.length);
          };
          TextEditChangeImpl2.prototype.assertChangeAnnotations = function(value) {
            if (value === void 0) {
              throw new Error("Text edit change is not configured to manage change annotations.");
            }
          };
          return TextEditChangeImpl2;
        })()
      );
      var ChangeAnnotations = (
        /** @class */
        (function() {
          function ChangeAnnotations2(annotations) {
            this._annotations = annotations === void 0 ? /* @__PURE__ */ Object.create(null) : annotations;
            this._counter = 0;
            this._size = 0;
          }
          ChangeAnnotations2.prototype.all = function() {
            return this._annotations;
          };
          Object.defineProperty(ChangeAnnotations2.prototype, "size", {
            get: function() {
              return this._size;
            },
            enumerable: false,
            configurable: true
          });
          ChangeAnnotations2.prototype.manage = function(idOrAnnotation, annotation) {
            var id;
            if (ChangeAnnotationIdentifier.is(idOrAnnotation)) {
              id = idOrAnnotation;
            } else {
              id = this.nextId();
              annotation = idOrAnnotation;
            }
            if (this._annotations[id] !== void 0) {
              throw new Error("Id ".concat(id, " is already in use."));
            }
            if (annotation === void 0) {
              throw new Error("No annotation provided for id ".concat(id));
            }
            this._annotations[id] = annotation;
            this._size++;
            return id;
          };
          ChangeAnnotations2.prototype.nextId = function() {
            this._counter++;
            return this._counter.toString();
          };
          return ChangeAnnotations2;
        })()
      );
      var WorkspaceChange = (
        /** @class */
        (function() {
          function WorkspaceChange2(workspaceEdit) {
            var _this = this;
            this._textEditChanges = /* @__PURE__ */ Object.create(null);
            if (workspaceEdit !== void 0) {
              this._workspaceEdit = workspaceEdit;
              if (workspaceEdit.documentChanges) {
                this._changeAnnotations = new ChangeAnnotations(workspaceEdit.changeAnnotations);
                workspaceEdit.changeAnnotations = this._changeAnnotations.all();
                workspaceEdit.documentChanges.forEach(function(change) {
                  if (TextDocumentEdit.is(change)) {
                    var textEditChange = new TextEditChangeImpl(change.edits, _this._changeAnnotations);
                    _this._textEditChanges[change.textDocument.uri] = textEditChange;
                  }
                });
              } else if (workspaceEdit.changes) {
                Object.keys(workspaceEdit.changes).forEach(function(key) {
                  var textEditChange = new TextEditChangeImpl(workspaceEdit.changes[key]);
                  _this._textEditChanges[key] = textEditChange;
                });
              }
            } else {
              this._workspaceEdit = {};
            }
          }
          Object.defineProperty(WorkspaceChange2.prototype, "edit", {
            /**
             * Returns the underlying {@link WorkspaceEdit} literal
             * use to be returned from a workspace edit operation like rename.
             */
            get: function() {
              this.initDocumentChanges();
              if (this._changeAnnotations !== void 0) {
                if (this._changeAnnotations.size === 0) {
                  this._workspaceEdit.changeAnnotations = void 0;
                } else {
                  this._workspaceEdit.changeAnnotations = this._changeAnnotations.all();
                }
              }
              return this._workspaceEdit;
            },
            enumerable: false,
            configurable: true
          });
          WorkspaceChange2.prototype.getTextEditChange = function(key) {
            if (OptionalVersionedTextDocumentIdentifier.is(key)) {
              this.initDocumentChanges();
              if (this._workspaceEdit.documentChanges === void 0) {
                throw new Error("Workspace edit is not configured for document changes.");
              }
              var textDocument = { uri: key.uri, version: key.version };
              var result = this._textEditChanges[textDocument.uri];
              if (!result) {
                var edits = [];
                var textDocumentEdit = {
                  textDocument,
                  edits
                };
                this._workspaceEdit.documentChanges.push(textDocumentEdit);
                result = new TextEditChangeImpl(edits, this._changeAnnotations);
                this._textEditChanges[textDocument.uri] = result;
              }
              return result;
            } else {
              this.initChanges();
              if (this._workspaceEdit.changes === void 0) {
                throw new Error("Workspace edit is not configured for normal text edit changes.");
              }
              var result = this._textEditChanges[key];
              if (!result) {
                var edits = [];
                this._workspaceEdit.changes[key] = edits;
                result = new TextEditChangeImpl(edits);
                this._textEditChanges[key] = result;
              }
              return result;
            }
          };
          WorkspaceChange2.prototype.initDocumentChanges = function() {
            if (this._workspaceEdit.documentChanges === void 0 && this._workspaceEdit.changes === void 0) {
              this._changeAnnotations = new ChangeAnnotations();
              this._workspaceEdit.documentChanges = [];
              this._workspaceEdit.changeAnnotations = this._changeAnnotations.all();
            }
          };
          WorkspaceChange2.prototype.initChanges = function() {
            if (this._workspaceEdit.documentChanges === void 0 && this._workspaceEdit.changes === void 0) {
              this._workspaceEdit.changes = /* @__PURE__ */ Object.create(null);
            }
          };
          WorkspaceChange2.prototype.createFile = function(uri, optionsOrAnnotation, options) {
            this.initDocumentChanges();
            if (this._workspaceEdit.documentChanges === void 0) {
              throw new Error("Workspace edit is not configured for document changes.");
            }
            var annotation;
            if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
              annotation = optionsOrAnnotation;
            } else {
              options = optionsOrAnnotation;
            }
            var operation;
            var id;
            if (annotation === void 0) {
              operation = CreateFile.create(uri, options);
            } else {
              id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
              operation = CreateFile.create(uri, options, id);
            }
            this._workspaceEdit.documentChanges.push(operation);
            if (id !== void 0) {
              return id;
            }
          };
          WorkspaceChange2.prototype.renameFile = function(oldUri, newUri, optionsOrAnnotation, options) {
            this.initDocumentChanges();
            if (this._workspaceEdit.documentChanges === void 0) {
              throw new Error("Workspace edit is not configured for document changes.");
            }
            var annotation;
            if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
              annotation = optionsOrAnnotation;
            } else {
              options = optionsOrAnnotation;
            }
            var operation;
            var id;
            if (annotation === void 0) {
              operation = RenameFile.create(oldUri, newUri, options);
            } else {
              id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
              operation = RenameFile.create(oldUri, newUri, options, id);
            }
            this._workspaceEdit.documentChanges.push(operation);
            if (id !== void 0) {
              return id;
            }
          };
          WorkspaceChange2.prototype.deleteFile = function(uri, optionsOrAnnotation, options) {
            this.initDocumentChanges();
            if (this._workspaceEdit.documentChanges === void 0) {
              throw new Error("Workspace edit is not configured for document changes.");
            }
            var annotation;
            if (ChangeAnnotation.is(optionsOrAnnotation) || ChangeAnnotationIdentifier.is(optionsOrAnnotation)) {
              annotation = optionsOrAnnotation;
            } else {
              options = optionsOrAnnotation;
            }
            var operation;
            var id;
            if (annotation === void 0) {
              operation = DeleteFile.create(uri, options);
            } else {
              id = ChangeAnnotationIdentifier.is(annotation) ? annotation : this._changeAnnotations.manage(annotation);
              operation = DeleteFile.create(uri, options, id);
            }
            this._workspaceEdit.documentChanges.push(operation);
            if (id !== void 0) {
              return id;
            }
          };
          return WorkspaceChange2;
        })()
      );
      exports2.WorkspaceChange = WorkspaceChange;
      var TextDocumentIdentifier;
      (function(TextDocumentIdentifier2) {
        function create(uri) {
          return { uri };
        }
        TextDocumentIdentifier2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.uri);
        }
        TextDocumentIdentifier2.is = is;
      })(TextDocumentIdentifier || (exports2.TextDocumentIdentifier = TextDocumentIdentifier = {}));
      var VersionedTextDocumentIdentifier;
      (function(VersionedTextDocumentIdentifier2) {
        function create(uri, version) {
          return { uri, version };
        }
        VersionedTextDocumentIdentifier2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.uri) && Is.integer(candidate.version);
        }
        VersionedTextDocumentIdentifier2.is = is;
      })(VersionedTextDocumentIdentifier || (exports2.VersionedTextDocumentIdentifier = VersionedTextDocumentIdentifier = {}));
      var OptionalVersionedTextDocumentIdentifier;
      (function(OptionalVersionedTextDocumentIdentifier2) {
        function create(uri, version) {
          return { uri, version };
        }
        OptionalVersionedTextDocumentIdentifier2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.uri) && (candidate.version === null || Is.integer(candidate.version));
        }
        OptionalVersionedTextDocumentIdentifier2.is = is;
      })(OptionalVersionedTextDocumentIdentifier || (exports2.OptionalVersionedTextDocumentIdentifier = OptionalVersionedTextDocumentIdentifier = {}));
      var TextDocumentItem;
      (function(TextDocumentItem2) {
        function create(uri, languageId, version, text) {
          return { uri, languageId, version, text };
        }
        TextDocumentItem2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.uri) && Is.string(candidate.languageId) && Is.integer(candidate.version) && Is.string(candidate.text);
        }
        TextDocumentItem2.is = is;
      })(TextDocumentItem || (exports2.TextDocumentItem = TextDocumentItem = {}));
      var MarkupKind2;
      (function(MarkupKind3) {
        MarkupKind3.PlainText = "plaintext";
        MarkupKind3.Markdown = "markdown";
        function is(value) {
          var candidate = value;
          return candidate === MarkupKind3.PlainText || candidate === MarkupKind3.Markdown;
        }
        MarkupKind3.is = is;
      })(MarkupKind2 || (exports2.MarkupKind = MarkupKind2 = {}));
      var MarkupContent;
      (function(MarkupContent2) {
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(value) && MarkupKind2.is(candidate.kind) && Is.string(candidate.value);
        }
        MarkupContent2.is = is;
      })(MarkupContent || (exports2.MarkupContent = MarkupContent = {}));
      var CompletionItemKind2;
      (function(CompletionItemKind3) {
        CompletionItemKind3.Text = 1;
        CompletionItemKind3.Method = 2;
        CompletionItemKind3.Function = 3;
        CompletionItemKind3.Constructor = 4;
        CompletionItemKind3.Field = 5;
        CompletionItemKind3.Variable = 6;
        CompletionItemKind3.Class = 7;
        CompletionItemKind3.Interface = 8;
        CompletionItemKind3.Module = 9;
        CompletionItemKind3.Property = 10;
        CompletionItemKind3.Unit = 11;
        CompletionItemKind3.Value = 12;
        CompletionItemKind3.Enum = 13;
        CompletionItemKind3.Keyword = 14;
        CompletionItemKind3.Snippet = 15;
        CompletionItemKind3.Color = 16;
        CompletionItemKind3.File = 17;
        CompletionItemKind3.Reference = 18;
        CompletionItemKind3.Folder = 19;
        CompletionItemKind3.EnumMember = 20;
        CompletionItemKind3.Constant = 21;
        CompletionItemKind3.Struct = 22;
        CompletionItemKind3.Event = 23;
        CompletionItemKind3.Operator = 24;
        CompletionItemKind3.TypeParameter = 25;
      })(CompletionItemKind2 || (exports2.CompletionItemKind = CompletionItemKind2 = {}));
      var InsertTextFormat;
      (function(InsertTextFormat2) {
        InsertTextFormat2.PlainText = 1;
        InsertTextFormat2.Snippet = 2;
      })(InsertTextFormat || (exports2.InsertTextFormat = InsertTextFormat = {}));
      var CompletionItemTag;
      (function(CompletionItemTag2) {
        CompletionItemTag2.Deprecated = 1;
      })(CompletionItemTag || (exports2.CompletionItemTag = CompletionItemTag = {}));
      var InsertReplaceEdit;
      (function(InsertReplaceEdit2) {
        function create(newText, insert, replace) {
          return { newText, insert, replace };
        }
        InsertReplaceEdit2.create = create;
        function is(value) {
          var candidate = value;
          return candidate && Is.string(candidate.newText) && Range2.is(candidate.insert) && Range2.is(candidate.replace);
        }
        InsertReplaceEdit2.is = is;
      })(InsertReplaceEdit || (exports2.InsertReplaceEdit = InsertReplaceEdit = {}));
      var InsertTextMode;
      (function(InsertTextMode2) {
        InsertTextMode2.asIs = 1;
        InsertTextMode2.adjustIndentation = 2;
      })(InsertTextMode || (exports2.InsertTextMode = InsertTextMode = {}));
      var CompletionItemLabelDetails;
      (function(CompletionItemLabelDetails2) {
        function is(value) {
          var candidate = value;
          return candidate && (Is.string(candidate.detail) || candidate.detail === void 0) && (Is.string(candidate.description) || candidate.description === void 0);
        }
        CompletionItemLabelDetails2.is = is;
      })(CompletionItemLabelDetails || (exports2.CompletionItemLabelDetails = CompletionItemLabelDetails = {}));
      var CompletionItem2;
      (function(CompletionItem3) {
        function create(label) {
          return { label };
        }
        CompletionItem3.create = create;
      })(CompletionItem2 || (exports2.CompletionItem = CompletionItem2 = {}));
      var CompletionList;
      (function(CompletionList2) {
        function create(items, isIncomplete) {
          return { items: items ? items : [], isIncomplete: !!isIncomplete };
        }
        CompletionList2.create = create;
      })(CompletionList || (exports2.CompletionList = CompletionList = {}));
      var MarkedString;
      (function(MarkedString2) {
        function fromPlainText(plainText) {
          return plainText.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
        }
        MarkedString2.fromPlainText = fromPlainText;
        function is(value) {
          var candidate = value;
          return Is.string(candidate) || Is.objectLiteral(candidate) && Is.string(candidate.language) && Is.string(candidate.value);
        }
        MarkedString2.is = is;
      })(MarkedString || (exports2.MarkedString = MarkedString = {}));
      var Hover2;
      (function(Hover3) {
        function is(value) {
          var candidate = value;
          return !!candidate && Is.objectLiteral(candidate) && (MarkupContent.is(candidate.contents) || MarkedString.is(candidate.contents) || Is.typedArray(candidate.contents, MarkedString.is)) && (value.range === void 0 || Range2.is(value.range));
        }
        Hover3.is = is;
      })(Hover2 || (exports2.Hover = Hover2 = {}));
      var ParameterInformation;
      (function(ParameterInformation2) {
        function create(label, documentation) {
          return documentation ? { label, documentation } : { label };
        }
        ParameterInformation2.create = create;
      })(ParameterInformation || (exports2.ParameterInformation = ParameterInformation = {}));
      var SignatureInformation2;
      (function(SignatureInformation3) {
        function create(label, documentation) {
          var parameters = [];
          for (var _i = 2; _i < arguments.length; _i++) {
            parameters[_i - 2] = arguments[_i];
          }
          var result = { label };
          if (Is.defined(documentation)) {
            result.documentation = documentation;
          }
          if (Is.defined(parameters)) {
            result.parameters = parameters;
          } else {
            result.parameters = [];
          }
          return result;
        }
        SignatureInformation3.create = create;
      })(SignatureInformation2 || (exports2.SignatureInformation = SignatureInformation2 = {}));
      var DocumentHighlightKind;
      (function(DocumentHighlightKind2) {
        DocumentHighlightKind2.Text = 1;
        DocumentHighlightKind2.Read = 2;
        DocumentHighlightKind2.Write = 3;
      })(DocumentHighlightKind || (exports2.DocumentHighlightKind = DocumentHighlightKind = {}));
      var DocumentHighlight;
      (function(DocumentHighlight2) {
        function create(range, kind) {
          var result = { range };
          if (Is.number(kind)) {
            result.kind = kind;
          }
          return result;
        }
        DocumentHighlight2.create = create;
      })(DocumentHighlight || (exports2.DocumentHighlight = DocumentHighlight = {}));
      var SymbolKind2;
      (function(SymbolKind3) {
        SymbolKind3.File = 1;
        SymbolKind3.Module = 2;
        SymbolKind3.Namespace = 3;
        SymbolKind3.Package = 4;
        SymbolKind3.Class = 5;
        SymbolKind3.Method = 6;
        SymbolKind3.Property = 7;
        SymbolKind3.Field = 8;
        SymbolKind3.Constructor = 9;
        SymbolKind3.Enum = 10;
        SymbolKind3.Interface = 11;
        SymbolKind3.Function = 12;
        SymbolKind3.Variable = 13;
        SymbolKind3.Constant = 14;
        SymbolKind3.String = 15;
        SymbolKind3.Number = 16;
        SymbolKind3.Boolean = 17;
        SymbolKind3.Array = 18;
        SymbolKind3.Object = 19;
        SymbolKind3.Key = 20;
        SymbolKind3.Null = 21;
        SymbolKind3.EnumMember = 22;
        SymbolKind3.Struct = 23;
        SymbolKind3.Event = 24;
        SymbolKind3.Operator = 25;
        SymbolKind3.TypeParameter = 26;
      })(SymbolKind2 || (exports2.SymbolKind = SymbolKind2 = {}));
      var SymbolTag;
      (function(SymbolTag2) {
        SymbolTag2.Deprecated = 1;
      })(SymbolTag || (exports2.SymbolTag = SymbolTag = {}));
      var SymbolInformation;
      (function(SymbolInformation2) {
        function create(name, kind, range, uri, containerName) {
          var result = {
            name,
            kind,
            location: { uri, range }
          };
          if (containerName) {
            result.containerName = containerName;
          }
          return result;
        }
        SymbolInformation2.create = create;
      })(SymbolInformation || (exports2.SymbolInformation = SymbolInformation = {}));
      var WorkspaceSymbol;
      (function(WorkspaceSymbol2) {
        function create(name, kind, uri, range) {
          return range !== void 0 ? { name, kind, location: { uri, range } } : { name, kind, location: { uri } };
        }
        WorkspaceSymbol2.create = create;
      })(WorkspaceSymbol || (exports2.WorkspaceSymbol = WorkspaceSymbol = {}));
      var DocumentSymbol2;
      (function(DocumentSymbol3) {
        function create(name, detail, kind, range, selectionRange, children) {
          var result = {
            name,
            detail,
            kind,
            range,
            selectionRange
          };
          if (children !== void 0) {
            result.children = children;
          }
          return result;
        }
        DocumentSymbol3.create = create;
        function is(value) {
          var candidate = value;
          return candidate && Is.string(candidate.name) && Is.number(candidate.kind) && Range2.is(candidate.range) && Range2.is(candidate.selectionRange) && (candidate.detail === void 0 || Is.string(candidate.detail)) && (candidate.deprecated === void 0 || Is.boolean(candidate.deprecated)) && (candidate.children === void 0 || Array.isArray(candidate.children)) && (candidate.tags === void 0 || Array.isArray(candidate.tags));
        }
        DocumentSymbol3.is = is;
      })(DocumentSymbol2 || (exports2.DocumentSymbol = DocumentSymbol2 = {}));
      var CodeActionKind2;
      (function(CodeActionKind3) {
        CodeActionKind3.Empty = "";
        CodeActionKind3.QuickFix = "quickfix";
        CodeActionKind3.Refactor = "refactor";
        CodeActionKind3.RefactorExtract = "refactor.extract";
        CodeActionKind3.RefactorInline = "refactor.inline";
        CodeActionKind3.RefactorRewrite = "refactor.rewrite";
        CodeActionKind3.Source = "source";
        CodeActionKind3.SourceOrganizeImports = "source.organizeImports";
        CodeActionKind3.SourceFixAll = "source.fixAll";
      })(CodeActionKind2 || (exports2.CodeActionKind = CodeActionKind2 = {}));
      var CodeActionTriggerKind;
      (function(CodeActionTriggerKind2) {
        CodeActionTriggerKind2.Invoked = 1;
        CodeActionTriggerKind2.Automatic = 2;
      })(CodeActionTriggerKind || (exports2.CodeActionTriggerKind = CodeActionTriggerKind = {}));
      var CodeActionContext;
      (function(CodeActionContext2) {
        function create(diagnostics, only, triggerKind) {
          var result = { diagnostics };
          if (only !== void 0 && only !== null) {
            result.only = only;
          }
          if (triggerKind !== void 0 && triggerKind !== null) {
            result.triggerKind = triggerKind;
          }
          return result;
        }
        CodeActionContext2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.typedArray(candidate.diagnostics, Diagnostic2.is) && (candidate.only === void 0 || Is.typedArray(candidate.only, Is.string)) && (candidate.triggerKind === void 0 || candidate.triggerKind === CodeActionTriggerKind.Invoked || candidate.triggerKind === CodeActionTriggerKind.Automatic);
        }
        CodeActionContext2.is = is;
      })(CodeActionContext || (exports2.CodeActionContext = CodeActionContext = {}));
      var CodeAction2;
      (function(CodeAction3) {
        function create(title, kindOrCommandOrEdit, kind) {
          var result = { title };
          var checkKind = true;
          if (typeof kindOrCommandOrEdit === "string") {
            checkKind = false;
            result.kind = kindOrCommandOrEdit;
          } else if (Command.is(kindOrCommandOrEdit)) {
            result.command = kindOrCommandOrEdit;
          } else {
            result.edit = kindOrCommandOrEdit;
          }
          if (checkKind && kind !== void 0) {
            result.kind = kind;
          }
          return result;
        }
        CodeAction3.create = create;
        function is(value) {
          var candidate = value;
          return candidate && Is.string(candidate.title) && (candidate.diagnostics === void 0 || Is.typedArray(candidate.diagnostics, Diagnostic2.is)) && (candidate.kind === void 0 || Is.string(candidate.kind)) && (candidate.edit !== void 0 || candidate.command !== void 0) && (candidate.command === void 0 || Command.is(candidate.command)) && (candidate.isPreferred === void 0 || Is.boolean(candidate.isPreferred)) && (candidate.edit === void 0 || WorkspaceEdit2.is(candidate.edit));
        }
        CodeAction3.is = is;
      })(CodeAction2 || (exports2.CodeAction = CodeAction2 = {}));
      var CodeLens;
      (function(CodeLens2) {
        function create(range, data) {
          var result = { range };
          if (Is.defined(data)) {
            result.data = data;
          }
          return result;
        }
        CodeLens2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Range2.is(candidate.range) && (Is.undefined(candidate.command) || Command.is(candidate.command));
        }
        CodeLens2.is = is;
      })(CodeLens || (exports2.CodeLens = CodeLens = {}));
      var FormattingOptions;
      (function(FormattingOptions2) {
        function create(tabSize, insertSpaces) {
          return { tabSize, insertSpaces };
        }
        FormattingOptions2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.uinteger(candidate.tabSize) && Is.boolean(candidate.insertSpaces);
        }
        FormattingOptions2.is = is;
      })(FormattingOptions || (exports2.FormattingOptions = FormattingOptions = {}));
      var DocumentLink;
      (function(DocumentLink2) {
        function create(range, target, data) {
          return { range, target, data };
        }
        DocumentLink2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Range2.is(candidate.range) && (Is.undefined(candidate.target) || Is.string(candidate.target));
        }
        DocumentLink2.is = is;
      })(DocumentLink || (exports2.DocumentLink = DocumentLink = {}));
      var SelectionRange;
      (function(SelectionRange2) {
        function create(range, parent) {
          return { range, parent };
        }
        SelectionRange2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Range2.is(candidate.range) && (candidate.parent === void 0 || SelectionRange2.is(candidate.parent));
        }
        SelectionRange2.is = is;
      })(SelectionRange || (exports2.SelectionRange = SelectionRange = {}));
      var SemanticTokenTypes;
      (function(SemanticTokenTypes2) {
        SemanticTokenTypes2["namespace"] = "namespace";
        SemanticTokenTypes2["type"] = "type";
        SemanticTokenTypes2["class"] = "class";
        SemanticTokenTypes2["enum"] = "enum";
        SemanticTokenTypes2["interface"] = "interface";
        SemanticTokenTypes2["struct"] = "struct";
        SemanticTokenTypes2["typeParameter"] = "typeParameter";
        SemanticTokenTypes2["parameter"] = "parameter";
        SemanticTokenTypes2["variable"] = "variable";
        SemanticTokenTypes2["property"] = "property";
        SemanticTokenTypes2["enumMember"] = "enumMember";
        SemanticTokenTypes2["event"] = "event";
        SemanticTokenTypes2["function"] = "function";
        SemanticTokenTypes2["method"] = "method";
        SemanticTokenTypes2["macro"] = "macro";
        SemanticTokenTypes2["keyword"] = "keyword";
        SemanticTokenTypes2["modifier"] = "modifier";
        SemanticTokenTypes2["comment"] = "comment";
        SemanticTokenTypes2["string"] = "string";
        SemanticTokenTypes2["number"] = "number";
        SemanticTokenTypes2["regexp"] = "regexp";
        SemanticTokenTypes2["operator"] = "operator";
        SemanticTokenTypes2["decorator"] = "decorator";
      })(SemanticTokenTypes || (exports2.SemanticTokenTypes = SemanticTokenTypes = {}));
      var SemanticTokenModifiers;
      (function(SemanticTokenModifiers2) {
        SemanticTokenModifiers2["declaration"] = "declaration";
        SemanticTokenModifiers2["definition"] = "definition";
        SemanticTokenModifiers2["readonly"] = "readonly";
        SemanticTokenModifiers2["static"] = "static";
        SemanticTokenModifiers2["deprecated"] = "deprecated";
        SemanticTokenModifiers2["abstract"] = "abstract";
        SemanticTokenModifiers2["async"] = "async";
        SemanticTokenModifiers2["modification"] = "modification";
        SemanticTokenModifiers2["documentation"] = "documentation";
        SemanticTokenModifiers2["defaultLibrary"] = "defaultLibrary";
      })(SemanticTokenModifiers || (exports2.SemanticTokenModifiers = SemanticTokenModifiers = {}));
      var SemanticTokens2;
      (function(SemanticTokens3) {
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && (candidate.resultId === void 0 || typeof candidate.resultId === "string") && Array.isArray(candidate.data) && (candidate.data.length === 0 || typeof candidate.data[0] === "number");
        }
        SemanticTokens3.is = is;
      })(SemanticTokens2 || (exports2.SemanticTokens = SemanticTokens2 = {}));
      var InlineValueText;
      (function(InlineValueText2) {
        function create(range, text) {
          return { range, text };
        }
        InlineValueText2.create = create;
        function is(value) {
          var candidate = value;
          return candidate !== void 0 && candidate !== null && Range2.is(candidate.range) && Is.string(candidate.text);
        }
        InlineValueText2.is = is;
      })(InlineValueText || (exports2.InlineValueText = InlineValueText = {}));
      var InlineValueVariableLookup;
      (function(InlineValueVariableLookup2) {
        function create(range, variableName, caseSensitiveLookup) {
          return { range, variableName, caseSensitiveLookup };
        }
        InlineValueVariableLookup2.create = create;
        function is(value) {
          var candidate = value;
          return candidate !== void 0 && candidate !== null && Range2.is(candidate.range) && Is.boolean(candidate.caseSensitiveLookup) && (Is.string(candidate.variableName) || candidate.variableName === void 0);
        }
        InlineValueVariableLookup2.is = is;
      })(InlineValueVariableLookup || (exports2.InlineValueVariableLookup = InlineValueVariableLookup = {}));
      var InlineValueEvaluatableExpression;
      (function(InlineValueEvaluatableExpression2) {
        function create(range, expression) {
          return { range, expression };
        }
        InlineValueEvaluatableExpression2.create = create;
        function is(value) {
          var candidate = value;
          return candidate !== void 0 && candidate !== null && Range2.is(candidate.range) && (Is.string(candidate.expression) || candidate.expression === void 0);
        }
        InlineValueEvaluatableExpression2.is = is;
      })(InlineValueEvaluatableExpression || (exports2.InlineValueEvaluatableExpression = InlineValueEvaluatableExpression = {}));
      var InlineValueContext;
      (function(InlineValueContext2) {
        function create(frameId, stoppedLocation) {
          return { frameId, stoppedLocation };
        }
        InlineValueContext2.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Range2.is(value.stoppedLocation);
        }
        InlineValueContext2.is = is;
      })(InlineValueContext || (exports2.InlineValueContext = InlineValueContext = {}));
      var InlayHintKind;
      (function(InlayHintKind2) {
        InlayHintKind2.Type = 1;
        InlayHintKind2.Parameter = 2;
        function is(value) {
          return value === 1 || value === 2;
        }
        InlayHintKind2.is = is;
      })(InlayHintKind || (exports2.InlayHintKind = InlayHintKind = {}));
      var InlayHintLabelPart;
      (function(InlayHintLabelPart2) {
        function create(value) {
          return { value };
        }
        InlayHintLabelPart2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && (candidate.tooltip === void 0 || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip)) && (candidate.location === void 0 || Location2.is(candidate.location)) && (candidate.command === void 0 || Command.is(candidate.command));
        }
        InlayHintLabelPart2.is = is;
      })(InlayHintLabelPart || (exports2.InlayHintLabelPart = InlayHintLabelPart = {}));
      var InlayHint;
      (function(InlayHint2) {
        function create(position, label, kind) {
          var result = { position, label };
          if (kind !== void 0) {
            result.kind = kind;
          }
          return result;
        }
        InlayHint2.create = create;
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && Position2.is(candidate.position) && (Is.string(candidate.label) || Is.typedArray(candidate.label, InlayHintLabelPart.is)) && (candidate.kind === void 0 || InlayHintKind.is(candidate.kind)) && candidate.textEdits === void 0 || Is.typedArray(candidate.textEdits, TextEdit2.is) && (candidate.tooltip === void 0 || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip)) && (candidate.paddingLeft === void 0 || Is.boolean(candidate.paddingLeft)) && (candidate.paddingRight === void 0 || Is.boolean(candidate.paddingRight));
        }
        InlayHint2.is = is;
      })(InlayHint || (exports2.InlayHint = InlayHint = {}));
      var StringValue;
      (function(StringValue2) {
        function createSnippet(value) {
          return { kind: "snippet", value };
        }
        StringValue2.createSnippet = createSnippet;
      })(StringValue || (exports2.StringValue = StringValue = {}));
      var InlineCompletionItem;
      (function(InlineCompletionItem2) {
        function create(insertText, filterText, range, command) {
          return { insertText, filterText, range, command };
        }
        InlineCompletionItem2.create = create;
      })(InlineCompletionItem || (exports2.InlineCompletionItem = InlineCompletionItem = {}));
      var InlineCompletionList;
      (function(InlineCompletionList2) {
        function create(items) {
          return { items };
        }
        InlineCompletionList2.create = create;
      })(InlineCompletionList || (exports2.InlineCompletionList = InlineCompletionList = {}));
      var InlineCompletionTriggerKind;
      (function(InlineCompletionTriggerKind2) {
        InlineCompletionTriggerKind2.Invoked = 0;
        InlineCompletionTriggerKind2.Automatic = 1;
      })(InlineCompletionTriggerKind || (exports2.InlineCompletionTriggerKind = InlineCompletionTriggerKind = {}));
      var SelectedCompletionInfo;
      (function(SelectedCompletionInfo2) {
        function create(range, text) {
          return { range, text };
        }
        SelectedCompletionInfo2.create = create;
      })(SelectedCompletionInfo || (exports2.SelectedCompletionInfo = SelectedCompletionInfo = {}));
      var InlineCompletionContext;
      (function(InlineCompletionContext2) {
        function create(triggerKind, selectedCompletionInfo) {
          return { triggerKind, selectedCompletionInfo };
        }
        InlineCompletionContext2.create = create;
      })(InlineCompletionContext || (exports2.InlineCompletionContext = InlineCompletionContext = {}));
      var WorkspaceFolder;
      (function(WorkspaceFolder2) {
        function is(value) {
          var candidate = value;
          return Is.objectLiteral(candidate) && URI.is(candidate.uri) && Is.string(candidate.name);
        }
        WorkspaceFolder2.is = is;
      })(WorkspaceFolder || (exports2.WorkspaceFolder = WorkspaceFolder = {}));
      exports2.EOL = ["\n", "\r\n", "\r"];
      var TextDocument2;
      (function(TextDocument3) {
        function create(uri, languageId, version, content) {
          return new FullTextDocument2(uri, languageId, version, content);
        }
        TextDocument3.create = create;
        function is(value) {
          var candidate = value;
          return Is.defined(candidate) && Is.string(candidate.uri) && (Is.undefined(candidate.languageId) || Is.string(candidate.languageId)) && Is.uinteger(candidate.lineCount) && Is.func(candidate.getText) && Is.func(candidate.positionAt) && Is.func(candidate.offsetAt) ? true : false;
        }
        TextDocument3.is = is;
        function applyEdits(document, edits) {
          var text = document.getText();
          var sortedEdits = mergeSort2(edits, function(a, b) {
            var diff = a.range.start.line - b.range.start.line;
            if (diff === 0) {
              return a.range.start.character - b.range.start.character;
            }
            return diff;
          });
          var lastModifiedOffset = text.length;
          for (var i = sortedEdits.length - 1; i >= 0; i--) {
            var e = sortedEdits[i];
            var startOffset = document.offsetAt(e.range.start);
            var endOffset = document.offsetAt(e.range.end);
            if (endOffset <= lastModifiedOffset) {
              text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
            } else {
              throw new Error("Overlapping edit");
            }
            lastModifiedOffset = startOffset;
          }
          return text;
        }
        TextDocument3.applyEdits = applyEdits;
        function mergeSort2(data, compare) {
          if (data.length <= 1) {
            return data;
          }
          var p = data.length / 2 | 0;
          var left = data.slice(0, p);
          var right = data.slice(p);
          mergeSort2(left, compare);
          mergeSort2(right, compare);
          var leftIdx = 0;
          var rightIdx = 0;
          var i = 0;
          while (leftIdx < left.length && rightIdx < right.length) {
            var ret = compare(left[leftIdx], right[rightIdx]);
            if (ret <= 0) {
              data[i++] = left[leftIdx++];
            } else {
              data[i++] = right[rightIdx++];
            }
          }
          while (leftIdx < left.length) {
            data[i++] = left[leftIdx++];
          }
          while (rightIdx < right.length) {
            data[i++] = right[rightIdx++];
          }
          return data;
        }
      })(TextDocument2 || (exports2.TextDocument = TextDocument2 = {}));
      var FullTextDocument2 = (
        /** @class */
        (function() {
          function FullTextDocument3(uri, languageId, version, content) {
            this._uri = uri;
            this._languageId = languageId;
            this._version = version;
            this._content = content;
            this._lineOffsets = void 0;
          }
          Object.defineProperty(FullTextDocument3.prototype, "uri", {
            get: function() {
              return this._uri;
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(FullTextDocument3.prototype, "languageId", {
            get: function() {
              return this._languageId;
            },
            enumerable: false,
            configurable: true
          });
          Object.defineProperty(FullTextDocument3.prototype, "version", {
            get: function() {
              return this._version;
            },
            enumerable: false,
            configurable: true
          });
          FullTextDocument3.prototype.getText = function(range) {
            if (range) {
              var start = this.offsetAt(range.start);
              var end = this.offsetAt(range.end);
              return this._content.substring(start, end);
            }
            return this._content;
          };
          FullTextDocument3.prototype.update = function(event, version) {
            this._content = event.text;
            this._version = version;
            this._lineOffsets = void 0;
          };
          FullTextDocument3.prototype.getLineOffsets = function() {
            if (this._lineOffsets === void 0) {
              var lineOffsets = [];
              var text = this._content;
              var isLineStart = true;
              for (var i = 0; i < text.length; i++) {
                if (isLineStart) {
                  lineOffsets.push(i);
                  isLineStart = false;
                }
                var ch = text.charAt(i);
                isLineStart = ch === "\r" || ch === "\n";
                if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
                  i++;
                }
              }
              if (isLineStart && text.length > 0) {
                lineOffsets.push(text.length);
              }
              this._lineOffsets = lineOffsets;
            }
            return this._lineOffsets;
          };
          FullTextDocument3.prototype.positionAt = function(offset) {
            offset = Math.max(Math.min(offset, this._content.length), 0);
            var lineOffsets = this.getLineOffsets();
            var low = 0, high = lineOffsets.length;
            if (high === 0) {
              return Position2.create(0, offset);
            }
            while (low < high) {
              var mid = Math.floor((low + high) / 2);
              if (lineOffsets[mid] > offset) {
                high = mid;
              } else {
                low = mid + 1;
              }
            }
            var line = low - 1;
            return Position2.create(line, offset - lineOffsets[line]);
          };
          FullTextDocument3.prototype.offsetAt = function(position) {
            var lineOffsets = this.getLineOffsets();
            if (position.line >= lineOffsets.length) {
              return this._content.length;
            } else if (position.line < 0) {
              return 0;
            }
            var lineOffset = lineOffsets[position.line];
            var nextLineOffset = position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
            return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
          };
          Object.defineProperty(FullTextDocument3.prototype, "lineCount", {
            get: function() {
              return this.getLineOffsets().length;
            },
            enumerable: false,
            configurable: true
          });
          return FullTextDocument3;
        })()
      );
      var Is;
      (function(Is2) {
        var toString = Object.prototype.toString;
        function defined(value) {
          return typeof value !== "undefined";
        }
        Is2.defined = defined;
        function undefined2(value) {
          return typeof value === "undefined";
        }
        Is2.undefined = undefined2;
        function boolean(value) {
          return value === true || value === false;
        }
        Is2.boolean = boolean;
        function string(value) {
          return toString.call(value) === "[object String]";
        }
        Is2.string = string;
        function number(value) {
          return toString.call(value) === "[object Number]";
        }
        Is2.number = number;
        function numberRange(value, min, max) {
          return toString.call(value) === "[object Number]" && min <= value && value <= max;
        }
        Is2.numberRange = numberRange;
        function integer2(value) {
          return toString.call(value) === "[object Number]" && -2147483648 <= value && value <= 2147483647;
        }
        Is2.integer = integer2;
        function uinteger2(value) {
          return toString.call(value) === "[object Number]" && 0 <= value && value <= 2147483647;
        }
        Is2.uinteger = uinteger2;
        function func(value) {
          return toString.call(value) === "[object Function]";
        }
        Is2.func = func;
        function objectLiteral(value) {
          return value !== null && typeof value === "object";
        }
        Is2.objectLiteral = objectLiteral;
        function typedArray(value, check) {
          return Array.isArray(value) && value.every(check);
        }
        Is2.typedArray = typedArray;
      })(Is || (Is = {}));
    });
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/messages.js
var require_messages2 = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProtocolNotificationType = exports.ProtocolNotificationType0 = exports.ProtocolRequestType = exports.ProtocolRequestType0 = exports.RegistrationType = exports.MessageDirection = void 0;
    var vscode_jsonrpc_1 = require_main();
    var MessageDirection;
    (function(MessageDirection2) {
      MessageDirection2["clientToServer"] = "clientToServer";
      MessageDirection2["serverToClient"] = "serverToClient";
      MessageDirection2["both"] = "both";
    })(MessageDirection || (exports.MessageDirection = MessageDirection = {}));
    var RegistrationType = class {
      constructor(method) {
        this.method = method;
      }
    };
    exports.RegistrationType = RegistrationType;
    var ProtocolRequestType0 = class extends vscode_jsonrpc_1.RequestType0 {
      constructor(method) {
        super(method);
      }
    };
    exports.ProtocolRequestType0 = ProtocolRequestType0;
    var ProtocolRequestType = class extends vscode_jsonrpc_1.RequestType {
      constructor(method) {
        super(method, vscode_jsonrpc_1.ParameterStructures.byName);
      }
    };
    exports.ProtocolRequestType = ProtocolRequestType;
    var ProtocolNotificationType0 = class extends vscode_jsonrpc_1.NotificationType0 {
      constructor(method) {
        super(method);
      }
    };
    exports.ProtocolNotificationType0 = ProtocolNotificationType0;
    var ProtocolNotificationType = class extends vscode_jsonrpc_1.NotificationType {
      constructor(method) {
        super(method, vscode_jsonrpc_1.ParameterStructures.byName);
      }
    };
    exports.ProtocolNotificationType = ProtocolNotificationType;
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/utils/is.js
var require_is3 = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/utils/is.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.objectLiteral = exports.typedArray = exports.stringArray = exports.array = exports.func = exports.error = exports.number = exports.string = exports.boolean = void 0;
    function boolean(value) {
      return value === true || value === false;
    }
    exports.boolean = boolean;
    function string(value) {
      return typeof value === "string" || value instanceof String;
    }
    exports.string = string;
    function number(value) {
      return typeof value === "number" || value instanceof Number;
    }
    exports.number = number;
    function error(value) {
      return value instanceof Error;
    }
    exports.error = error;
    function func(value) {
      return typeof value === "function";
    }
    exports.func = func;
    function array(value) {
      return Array.isArray(value);
    }
    exports.array = array;
    function stringArray(value) {
      return array(value) && value.every((elem) => string(elem));
    }
    exports.stringArray = stringArray;
    function typedArray(value, check) {
      return Array.isArray(value) && value.every(check);
    }
    exports.typedArray = typedArray;
    function objectLiteral(value) {
      return value !== null && typeof value === "object";
    }
    exports.objectLiteral = objectLiteral;
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.implementation.js
var require_protocol_implementation = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.implementation.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ImplementationRequest = void 0;
    var messages_1 = require_messages2();
    var ImplementationRequest;
    (function(ImplementationRequest2) {
      ImplementationRequest2.method = "textDocument/implementation";
      ImplementationRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      ImplementationRequest2.type = new messages_1.ProtocolRequestType(ImplementationRequest2.method);
    })(ImplementationRequest || (exports.ImplementationRequest = ImplementationRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.typeDefinition.js
var require_protocol_typeDefinition = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.typeDefinition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeDefinitionRequest = void 0;
    var messages_1 = require_messages2();
    var TypeDefinitionRequest;
    (function(TypeDefinitionRequest2) {
      TypeDefinitionRequest2.method = "textDocument/typeDefinition";
      TypeDefinitionRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      TypeDefinitionRequest2.type = new messages_1.ProtocolRequestType(TypeDefinitionRequest2.method);
    })(TypeDefinitionRequest || (exports.TypeDefinitionRequest = TypeDefinitionRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.workspaceFolder.js
var require_protocol_workspaceFolder = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.workspaceFolder.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DidChangeWorkspaceFoldersNotification = exports.WorkspaceFoldersRequest = void 0;
    var messages_1 = require_messages2();
    var WorkspaceFoldersRequest;
    (function(WorkspaceFoldersRequest2) {
      WorkspaceFoldersRequest2.method = "workspace/workspaceFolders";
      WorkspaceFoldersRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      WorkspaceFoldersRequest2.type = new messages_1.ProtocolRequestType0(WorkspaceFoldersRequest2.method);
    })(WorkspaceFoldersRequest || (exports.WorkspaceFoldersRequest = WorkspaceFoldersRequest = {}));
    var DidChangeWorkspaceFoldersNotification;
    (function(DidChangeWorkspaceFoldersNotification2) {
      DidChangeWorkspaceFoldersNotification2.method = "workspace/didChangeWorkspaceFolders";
      DidChangeWorkspaceFoldersNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidChangeWorkspaceFoldersNotification2.type = new messages_1.ProtocolNotificationType(DidChangeWorkspaceFoldersNotification2.method);
    })(DidChangeWorkspaceFoldersNotification || (exports.DidChangeWorkspaceFoldersNotification = DidChangeWorkspaceFoldersNotification = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.configuration.js
var require_protocol_configuration = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.configuration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConfigurationRequest = void 0;
    var messages_1 = require_messages2();
    var ConfigurationRequest;
    (function(ConfigurationRequest2) {
      ConfigurationRequest2.method = "workspace/configuration";
      ConfigurationRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      ConfigurationRequest2.type = new messages_1.ProtocolRequestType(ConfigurationRequest2.method);
    })(ConfigurationRequest || (exports.ConfigurationRequest = ConfigurationRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.colorProvider.js
var require_protocol_colorProvider = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.colorProvider.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ColorPresentationRequest = exports.DocumentColorRequest = void 0;
    var messages_1 = require_messages2();
    var DocumentColorRequest;
    (function(DocumentColorRequest2) {
      DocumentColorRequest2.method = "textDocument/documentColor";
      DocumentColorRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentColorRequest2.type = new messages_1.ProtocolRequestType(DocumentColorRequest2.method);
    })(DocumentColorRequest || (exports.DocumentColorRequest = DocumentColorRequest = {}));
    var ColorPresentationRequest;
    (function(ColorPresentationRequest2) {
      ColorPresentationRequest2.method = "textDocument/colorPresentation";
      ColorPresentationRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      ColorPresentationRequest2.type = new messages_1.ProtocolRequestType(ColorPresentationRequest2.method);
    })(ColorPresentationRequest || (exports.ColorPresentationRequest = ColorPresentationRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.foldingRange.js
var require_protocol_foldingRange = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.foldingRange.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FoldingRangeRefreshRequest = exports.FoldingRangeRequest = void 0;
    var messages_1 = require_messages2();
    var FoldingRangeRequest;
    (function(FoldingRangeRequest2) {
      FoldingRangeRequest2.method = "textDocument/foldingRange";
      FoldingRangeRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      FoldingRangeRequest2.type = new messages_1.ProtocolRequestType(FoldingRangeRequest2.method);
    })(FoldingRangeRequest || (exports.FoldingRangeRequest = FoldingRangeRequest = {}));
    var FoldingRangeRefreshRequest;
    (function(FoldingRangeRefreshRequest2) {
      FoldingRangeRefreshRequest2.method = `workspace/foldingRange/refresh`;
      FoldingRangeRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      FoldingRangeRefreshRequest2.type = new messages_1.ProtocolRequestType0(FoldingRangeRefreshRequest2.method);
    })(FoldingRangeRefreshRequest || (exports.FoldingRangeRefreshRequest = FoldingRangeRefreshRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.declaration.js
var require_protocol_declaration = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.declaration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DeclarationRequest = void 0;
    var messages_1 = require_messages2();
    var DeclarationRequest;
    (function(DeclarationRequest2) {
      DeclarationRequest2.method = "textDocument/declaration";
      DeclarationRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DeclarationRequest2.type = new messages_1.ProtocolRequestType(DeclarationRequest2.method);
    })(DeclarationRequest || (exports.DeclarationRequest = DeclarationRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.selectionRange.js
var require_protocol_selectionRange = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.selectionRange.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SelectionRangeRequest = void 0;
    var messages_1 = require_messages2();
    var SelectionRangeRequest;
    (function(SelectionRangeRequest2) {
      SelectionRangeRequest2.method = "textDocument/selectionRange";
      SelectionRangeRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      SelectionRangeRequest2.type = new messages_1.ProtocolRequestType(SelectionRangeRequest2.method);
    })(SelectionRangeRequest || (exports.SelectionRangeRequest = SelectionRangeRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.progress.js
var require_protocol_progress = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.progress.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WorkDoneProgressCancelNotification = exports.WorkDoneProgressCreateRequest = exports.WorkDoneProgress = void 0;
    var vscode_jsonrpc_1 = require_main();
    var messages_1 = require_messages2();
    var WorkDoneProgress;
    (function(WorkDoneProgress2) {
      WorkDoneProgress2.type = new vscode_jsonrpc_1.ProgressType();
      function is(value) {
        return value === WorkDoneProgress2.type;
      }
      WorkDoneProgress2.is = is;
    })(WorkDoneProgress || (exports.WorkDoneProgress = WorkDoneProgress = {}));
    var WorkDoneProgressCreateRequest;
    (function(WorkDoneProgressCreateRequest2) {
      WorkDoneProgressCreateRequest2.method = "window/workDoneProgress/create";
      WorkDoneProgressCreateRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      WorkDoneProgressCreateRequest2.type = new messages_1.ProtocolRequestType(WorkDoneProgressCreateRequest2.method);
    })(WorkDoneProgressCreateRequest || (exports.WorkDoneProgressCreateRequest = WorkDoneProgressCreateRequest = {}));
    var WorkDoneProgressCancelNotification;
    (function(WorkDoneProgressCancelNotification2) {
      WorkDoneProgressCancelNotification2.method = "window/workDoneProgress/cancel";
      WorkDoneProgressCancelNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      WorkDoneProgressCancelNotification2.type = new messages_1.ProtocolNotificationType(WorkDoneProgressCancelNotification2.method);
    })(WorkDoneProgressCancelNotification || (exports.WorkDoneProgressCancelNotification = WorkDoneProgressCancelNotification = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.callHierarchy.js
var require_protocol_callHierarchy = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.callHierarchy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CallHierarchyOutgoingCallsRequest = exports.CallHierarchyIncomingCallsRequest = exports.CallHierarchyPrepareRequest = void 0;
    var messages_1 = require_messages2();
    var CallHierarchyPrepareRequest;
    (function(CallHierarchyPrepareRequest2) {
      CallHierarchyPrepareRequest2.method = "textDocument/prepareCallHierarchy";
      CallHierarchyPrepareRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CallHierarchyPrepareRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyPrepareRequest2.method);
    })(CallHierarchyPrepareRequest || (exports.CallHierarchyPrepareRequest = CallHierarchyPrepareRequest = {}));
    var CallHierarchyIncomingCallsRequest;
    (function(CallHierarchyIncomingCallsRequest2) {
      CallHierarchyIncomingCallsRequest2.method = "callHierarchy/incomingCalls";
      CallHierarchyIncomingCallsRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CallHierarchyIncomingCallsRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyIncomingCallsRequest2.method);
    })(CallHierarchyIncomingCallsRequest || (exports.CallHierarchyIncomingCallsRequest = CallHierarchyIncomingCallsRequest = {}));
    var CallHierarchyOutgoingCallsRequest;
    (function(CallHierarchyOutgoingCallsRequest2) {
      CallHierarchyOutgoingCallsRequest2.method = "callHierarchy/outgoingCalls";
      CallHierarchyOutgoingCallsRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CallHierarchyOutgoingCallsRequest2.type = new messages_1.ProtocolRequestType(CallHierarchyOutgoingCallsRequest2.method);
    })(CallHierarchyOutgoingCallsRequest || (exports.CallHierarchyOutgoingCallsRequest = CallHierarchyOutgoingCallsRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.semanticTokens.js
var require_protocol_semanticTokens = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.semanticTokens.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SemanticTokensRefreshRequest = exports.SemanticTokensRangeRequest = exports.SemanticTokensDeltaRequest = exports.SemanticTokensRequest = exports.SemanticTokensRegistrationType = exports.TokenFormat = void 0;
    var messages_1 = require_messages2();
    var TokenFormat;
    (function(TokenFormat2) {
      TokenFormat2.Relative = "relative";
    })(TokenFormat || (exports.TokenFormat = TokenFormat = {}));
    var SemanticTokensRegistrationType;
    (function(SemanticTokensRegistrationType2) {
      SemanticTokensRegistrationType2.method = "textDocument/semanticTokens";
      SemanticTokensRegistrationType2.type = new messages_1.RegistrationType(SemanticTokensRegistrationType2.method);
    })(SemanticTokensRegistrationType || (exports.SemanticTokensRegistrationType = SemanticTokensRegistrationType = {}));
    var SemanticTokensRequest;
    (function(SemanticTokensRequest2) {
      SemanticTokensRequest2.method = "textDocument/semanticTokens/full";
      SemanticTokensRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      SemanticTokensRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensRequest2.method);
      SemanticTokensRequest2.registrationMethod = SemanticTokensRegistrationType.method;
    })(SemanticTokensRequest || (exports.SemanticTokensRequest = SemanticTokensRequest = {}));
    var SemanticTokensDeltaRequest;
    (function(SemanticTokensDeltaRequest2) {
      SemanticTokensDeltaRequest2.method = "textDocument/semanticTokens/full/delta";
      SemanticTokensDeltaRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      SemanticTokensDeltaRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensDeltaRequest2.method);
      SemanticTokensDeltaRequest2.registrationMethod = SemanticTokensRegistrationType.method;
    })(SemanticTokensDeltaRequest || (exports.SemanticTokensDeltaRequest = SemanticTokensDeltaRequest = {}));
    var SemanticTokensRangeRequest;
    (function(SemanticTokensRangeRequest2) {
      SemanticTokensRangeRequest2.method = "textDocument/semanticTokens/range";
      SemanticTokensRangeRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      SemanticTokensRangeRequest2.type = new messages_1.ProtocolRequestType(SemanticTokensRangeRequest2.method);
      SemanticTokensRangeRequest2.registrationMethod = SemanticTokensRegistrationType.method;
    })(SemanticTokensRangeRequest || (exports.SemanticTokensRangeRequest = SemanticTokensRangeRequest = {}));
    var SemanticTokensRefreshRequest;
    (function(SemanticTokensRefreshRequest2) {
      SemanticTokensRefreshRequest2.method = `workspace/semanticTokens/refresh`;
      SemanticTokensRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      SemanticTokensRefreshRequest2.type = new messages_1.ProtocolRequestType0(SemanticTokensRefreshRequest2.method);
    })(SemanticTokensRefreshRequest || (exports.SemanticTokensRefreshRequest = SemanticTokensRefreshRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.showDocument.js
var require_protocol_showDocument = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.showDocument.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ShowDocumentRequest = void 0;
    var messages_1 = require_messages2();
    var ShowDocumentRequest;
    (function(ShowDocumentRequest2) {
      ShowDocumentRequest2.method = "window/showDocument";
      ShowDocumentRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      ShowDocumentRequest2.type = new messages_1.ProtocolRequestType(ShowDocumentRequest2.method);
    })(ShowDocumentRequest || (exports.ShowDocumentRequest = ShowDocumentRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.linkedEditingRange.js
var require_protocol_linkedEditingRange = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.linkedEditingRange.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LinkedEditingRangeRequest = void 0;
    var messages_1 = require_messages2();
    var LinkedEditingRangeRequest;
    (function(LinkedEditingRangeRequest2) {
      LinkedEditingRangeRequest2.method = "textDocument/linkedEditingRange";
      LinkedEditingRangeRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      LinkedEditingRangeRequest2.type = new messages_1.ProtocolRequestType(LinkedEditingRangeRequest2.method);
    })(LinkedEditingRangeRequest || (exports.LinkedEditingRangeRequest = LinkedEditingRangeRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.fileOperations.js
var require_protocol_fileOperations = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.fileOperations.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WillDeleteFilesRequest = exports.DidDeleteFilesNotification = exports.DidRenameFilesNotification = exports.WillRenameFilesRequest = exports.DidCreateFilesNotification = exports.WillCreateFilesRequest = exports.FileOperationPatternKind = void 0;
    var messages_1 = require_messages2();
    var FileOperationPatternKind;
    (function(FileOperationPatternKind2) {
      FileOperationPatternKind2.file = "file";
      FileOperationPatternKind2.folder = "folder";
    })(FileOperationPatternKind || (exports.FileOperationPatternKind = FileOperationPatternKind = {}));
    var WillCreateFilesRequest;
    (function(WillCreateFilesRequest2) {
      WillCreateFilesRequest2.method = "workspace/willCreateFiles";
      WillCreateFilesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WillCreateFilesRequest2.type = new messages_1.ProtocolRequestType(WillCreateFilesRequest2.method);
    })(WillCreateFilesRequest || (exports.WillCreateFilesRequest = WillCreateFilesRequest = {}));
    var DidCreateFilesNotification;
    (function(DidCreateFilesNotification2) {
      DidCreateFilesNotification2.method = "workspace/didCreateFiles";
      DidCreateFilesNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidCreateFilesNotification2.type = new messages_1.ProtocolNotificationType(DidCreateFilesNotification2.method);
    })(DidCreateFilesNotification || (exports.DidCreateFilesNotification = DidCreateFilesNotification = {}));
    var WillRenameFilesRequest;
    (function(WillRenameFilesRequest2) {
      WillRenameFilesRequest2.method = "workspace/willRenameFiles";
      WillRenameFilesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WillRenameFilesRequest2.type = new messages_1.ProtocolRequestType(WillRenameFilesRequest2.method);
    })(WillRenameFilesRequest || (exports.WillRenameFilesRequest = WillRenameFilesRequest = {}));
    var DidRenameFilesNotification;
    (function(DidRenameFilesNotification2) {
      DidRenameFilesNotification2.method = "workspace/didRenameFiles";
      DidRenameFilesNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidRenameFilesNotification2.type = new messages_1.ProtocolNotificationType(DidRenameFilesNotification2.method);
    })(DidRenameFilesNotification || (exports.DidRenameFilesNotification = DidRenameFilesNotification = {}));
    var DidDeleteFilesNotification;
    (function(DidDeleteFilesNotification2) {
      DidDeleteFilesNotification2.method = "workspace/didDeleteFiles";
      DidDeleteFilesNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidDeleteFilesNotification2.type = new messages_1.ProtocolNotificationType(DidDeleteFilesNotification2.method);
    })(DidDeleteFilesNotification || (exports.DidDeleteFilesNotification = DidDeleteFilesNotification = {}));
    var WillDeleteFilesRequest;
    (function(WillDeleteFilesRequest2) {
      WillDeleteFilesRequest2.method = "workspace/willDeleteFiles";
      WillDeleteFilesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WillDeleteFilesRequest2.type = new messages_1.ProtocolRequestType(WillDeleteFilesRequest2.method);
    })(WillDeleteFilesRequest || (exports.WillDeleteFilesRequest = WillDeleteFilesRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.moniker.js
var require_protocol_moniker = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.moniker.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MonikerRequest = exports.MonikerKind = exports.UniquenessLevel = void 0;
    var messages_1 = require_messages2();
    var UniquenessLevel;
    (function(UniquenessLevel2) {
      UniquenessLevel2.document = "document";
      UniquenessLevel2.project = "project";
      UniquenessLevel2.group = "group";
      UniquenessLevel2.scheme = "scheme";
      UniquenessLevel2.global = "global";
    })(UniquenessLevel || (exports.UniquenessLevel = UniquenessLevel = {}));
    var MonikerKind;
    (function(MonikerKind2) {
      MonikerKind2.$import = "import";
      MonikerKind2.$export = "export";
      MonikerKind2.local = "local";
    })(MonikerKind || (exports.MonikerKind = MonikerKind = {}));
    var MonikerRequest;
    (function(MonikerRequest2) {
      MonikerRequest2.method = "textDocument/moniker";
      MonikerRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      MonikerRequest2.type = new messages_1.ProtocolRequestType(MonikerRequest2.method);
    })(MonikerRequest || (exports.MonikerRequest = MonikerRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.typeHierarchy.js
var require_protocol_typeHierarchy = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.typeHierarchy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHierarchySubtypesRequest = exports.TypeHierarchySupertypesRequest = exports.TypeHierarchyPrepareRequest = void 0;
    var messages_1 = require_messages2();
    var TypeHierarchyPrepareRequest;
    (function(TypeHierarchyPrepareRequest2) {
      TypeHierarchyPrepareRequest2.method = "textDocument/prepareTypeHierarchy";
      TypeHierarchyPrepareRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      TypeHierarchyPrepareRequest2.type = new messages_1.ProtocolRequestType(TypeHierarchyPrepareRequest2.method);
    })(TypeHierarchyPrepareRequest || (exports.TypeHierarchyPrepareRequest = TypeHierarchyPrepareRequest = {}));
    var TypeHierarchySupertypesRequest;
    (function(TypeHierarchySupertypesRequest2) {
      TypeHierarchySupertypesRequest2.method = "typeHierarchy/supertypes";
      TypeHierarchySupertypesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      TypeHierarchySupertypesRequest2.type = new messages_1.ProtocolRequestType(TypeHierarchySupertypesRequest2.method);
    })(TypeHierarchySupertypesRequest || (exports.TypeHierarchySupertypesRequest = TypeHierarchySupertypesRequest = {}));
    var TypeHierarchySubtypesRequest;
    (function(TypeHierarchySubtypesRequest2) {
      TypeHierarchySubtypesRequest2.method = "typeHierarchy/subtypes";
      TypeHierarchySubtypesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      TypeHierarchySubtypesRequest2.type = new messages_1.ProtocolRequestType(TypeHierarchySubtypesRequest2.method);
    })(TypeHierarchySubtypesRequest || (exports.TypeHierarchySubtypesRequest = TypeHierarchySubtypesRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineValue.js
var require_protocol_inlineValue = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineValueRefreshRequest = exports.InlineValueRequest = void 0;
    var messages_1 = require_messages2();
    var InlineValueRequest;
    (function(InlineValueRequest2) {
      InlineValueRequest2.method = "textDocument/inlineValue";
      InlineValueRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      InlineValueRequest2.type = new messages_1.ProtocolRequestType(InlineValueRequest2.method);
    })(InlineValueRequest || (exports.InlineValueRequest = InlineValueRequest = {}));
    var InlineValueRefreshRequest;
    (function(InlineValueRefreshRequest2) {
      InlineValueRefreshRequest2.method = `workspace/inlineValue/refresh`;
      InlineValueRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      InlineValueRefreshRequest2.type = new messages_1.ProtocolRequestType0(InlineValueRefreshRequest2.method);
    })(InlineValueRefreshRequest || (exports.InlineValueRefreshRequest = InlineValueRefreshRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlayHint.js
var require_protocol_inlayHint = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.inlayHint.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlayHintRefreshRequest = exports.InlayHintResolveRequest = exports.InlayHintRequest = void 0;
    var messages_1 = require_messages2();
    var InlayHintRequest;
    (function(InlayHintRequest2) {
      InlayHintRequest2.method = "textDocument/inlayHint";
      InlayHintRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      InlayHintRequest2.type = new messages_1.ProtocolRequestType(InlayHintRequest2.method);
    })(InlayHintRequest || (exports.InlayHintRequest = InlayHintRequest = {}));
    var InlayHintResolveRequest;
    (function(InlayHintResolveRequest2) {
      InlayHintResolveRequest2.method = "inlayHint/resolve";
      InlayHintResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      InlayHintResolveRequest2.type = new messages_1.ProtocolRequestType(InlayHintResolveRequest2.method);
    })(InlayHintResolveRequest || (exports.InlayHintResolveRequest = InlayHintResolveRequest = {}));
    var InlayHintRefreshRequest;
    (function(InlayHintRefreshRequest2) {
      InlayHintRefreshRequest2.method = `workspace/inlayHint/refresh`;
      InlayHintRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      InlayHintRefreshRequest2.type = new messages_1.ProtocolRequestType0(InlayHintRefreshRequest2.method);
    })(InlayHintRefreshRequest || (exports.InlayHintRefreshRequest = InlayHintRefreshRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.diagnostic.js
var require_protocol_diagnostic = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.diagnostic.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiagnosticRefreshRequest = exports.WorkspaceDiagnosticRequest = exports.DocumentDiagnosticRequest = exports.DocumentDiagnosticReportKind = exports.DiagnosticServerCancellationData = void 0;
    var vscode_jsonrpc_1 = require_main();
    var Is = require_is3();
    var messages_1 = require_messages2();
    var DiagnosticServerCancellationData;
    (function(DiagnosticServerCancellationData2) {
      function is(value) {
        const candidate = value;
        return candidate && Is.boolean(candidate.retriggerRequest);
      }
      DiagnosticServerCancellationData2.is = is;
    })(DiagnosticServerCancellationData || (exports.DiagnosticServerCancellationData = DiagnosticServerCancellationData = {}));
    var DocumentDiagnosticReportKind;
    (function(DocumentDiagnosticReportKind2) {
      DocumentDiagnosticReportKind2.Full = "full";
      DocumentDiagnosticReportKind2.Unchanged = "unchanged";
    })(DocumentDiagnosticReportKind || (exports.DocumentDiagnosticReportKind = DocumentDiagnosticReportKind = {}));
    var DocumentDiagnosticRequest;
    (function(DocumentDiagnosticRequest2) {
      DocumentDiagnosticRequest2.method = "textDocument/diagnostic";
      DocumentDiagnosticRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentDiagnosticRequest2.type = new messages_1.ProtocolRequestType(DocumentDiagnosticRequest2.method);
      DocumentDiagnosticRequest2.partialResult = new vscode_jsonrpc_1.ProgressType();
    })(DocumentDiagnosticRequest || (exports.DocumentDiagnosticRequest = DocumentDiagnosticRequest = {}));
    var WorkspaceDiagnosticRequest;
    (function(WorkspaceDiagnosticRequest2) {
      WorkspaceDiagnosticRequest2.method = "workspace/diagnostic";
      WorkspaceDiagnosticRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WorkspaceDiagnosticRequest2.type = new messages_1.ProtocolRequestType(WorkspaceDiagnosticRequest2.method);
      WorkspaceDiagnosticRequest2.partialResult = new vscode_jsonrpc_1.ProgressType();
    })(WorkspaceDiagnosticRequest || (exports.WorkspaceDiagnosticRequest = WorkspaceDiagnosticRequest = {}));
    var DiagnosticRefreshRequest;
    (function(DiagnosticRefreshRequest2) {
      DiagnosticRefreshRequest2.method = `workspace/diagnostic/refresh`;
      DiagnosticRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      DiagnosticRefreshRequest2.type = new messages_1.ProtocolRequestType0(DiagnosticRefreshRequest2.method);
    })(DiagnosticRefreshRequest || (exports.DiagnosticRefreshRequest = DiagnosticRefreshRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.notebook.js
var require_protocol_notebook = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.notebook.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DidCloseNotebookDocumentNotification = exports.DidSaveNotebookDocumentNotification = exports.DidChangeNotebookDocumentNotification = exports.NotebookCellArrayChange = exports.DidOpenNotebookDocumentNotification = exports.NotebookDocumentSyncRegistrationType = exports.NotebookDocument = exports.NotebookCell = exports.ExecutionSummary = exports.NotebookCellKind = void 0;
    var vscode_languageserver_types_1 = require_main2();
    var Is = require_is3();
    var messages_1 = require_messages2();
    var NotebookCellKind;
    (function(NotebookCellKind2) {
      NotebookCellKind2.Markup = 1;
      NotebookCellKind2.Code = 2;
      function is(value) {
        return value === 1 || value === 2;
      }
      NotebookCellKind2.is = is;
    })(NotebookCellKind || (exports.NotebookCellKind = NotebookCellKind = {}));
    var ExecutionSummary;
    (function(ExecutionSummary2) {
      function create(executionOrder, success) {
        const result = { executionOrder };
        if (success === true || success === false) {
          result.success = success;
        }
        return result;
      }
      ExecutionSummary2.create = create;
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && vscode_languageserver_types_1.uinteger.is(candidate.executionOrder) && (candidate.success === void 0 || Is.boolean(candidate.success));
      }
      ExecutionSummary2.is = is;
      function equals(one, other) {
        if (one === other) {
          return true;
        }
        if (one === null || one === void 0 || other === null || other === void 0) {
          return false;
        }
        return one.executionOrder === other.executionOrder && one.success === other.success;
      }
      ExecutionSummary2.equals = equals;
    })(ExecutionSummary || (exports.ExecutionSummary = ExecutionSummary = {}));
    var NotebookCell;
    (function(NotebookCell2) {
      function create(kind, document) {
        return { kind, document };
      }
      NotebookCell2.create = create;
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && NotebookCellKind.is(candidate.kind) && vscode_languageserver_types_1.DocumentUri.is(candidate.document) && (candidate.metadata === void 0 || Is.objectLiteral(candidate.metadata));
      }
      NotebookCell2.is = is;
      function diff(one, two) {
        const result = /* @__PURE__ */ new Set();
        if (one.document !== two.document) {
          result.add("document");
        }
        if (one.kind !== two.kind) {
          result.add("kind");
        }
        if (one.executionSummary !== two.executionSummary) {
          result.add("executionSummary");
        }
        if ((one.metadata !== void 0 || two.metadata !== void 0) && !equalsMetadata(one.metadata, two.metadata)) {
          result.add("metadata");
        }
        if ((one.executionSummary !== void 0 || two.executionSummary !== void 0) && !ExecutionSummary.equals(one.executionSummary, two.executionSummary)) {
          result.add("executionSummary");
        }
        return result;
      }
      NotebookCell2.diff = diff;
      function equalsMetadata(one, other) {
        if (one === other) {
          return true;
        }
        if (one === null || one === void 0 || other === null || other === void 0) {
          return false;
        }
        if (typeof one !== typeof other) {
          return false;
        }
        if (typeof one !== "object") {
          return false;
        }
        const oneArray = Array.isArray(one);
        const otherArray = Array.isArray(other);
        if (oneArray !== otherArray) {
          return false;
        }
        if (oneArray && otherArray) {
          if (one.length !== other.length) {
            return false;
          }
          for (let i = 0; i < one.length; i++) {
            if (!equalsMetadata(one[i], other[i])) {
              return false;
            }
          }
        }
        if (Is.objectLiteral(one) && Is.objectLiteral(other)) {
          const oneKeys = Object.keys(one);
          const otherKeys = Object.keys(other);
          if (oneKeys.length !== otherKeys.length) {
            return false;
          }
          oneKeys.sort();
          otherKeys.sort();
          if (!equalsMetadata(oneKeys, otherKeys)) {
            return false;
          }
          for (let i = 0; i < oneKeys.length; i++) {
            const prop = oneKeys[i];
            if (!equalsMetadata(one[prop], other[prop])) {
              return false;
            }
          }
        }
        return true;
      }
    })(NotebookCell || (exports.NotebookCell = NotebookCell = {}));
    var NotebookDocument;
    (function(NotebookDocument2) {
      function create(uri, notebookType, version, cells) {
        return { uri, notebookType, version, cells };
      }
      NotebookDocument2.create = create;
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && Is.string(candidate.uri) && vscode_languageserver_types_1.integer.is(candidate.version) && Is.typedArray(candidate.cells, NotebookCell.is);
      }
      NotebookDocument2.is = is;
    })(NotebookDocument || (exports.NotebookDocument = NotebookDocument = {}));
    var NotebookDocumentSyncRegistrationType;
    (function(NotebookDocumentSyncRegistrationType2) {
      NotebookDocumentSyncRegistrationType2.method = "notebookDocument/sync";
      NotebookDocumentSyncRegistrationType2.messageDirection = messages_1.MessageDirection.clientToServer;
      NotebookDocumentSyncRegistrationType2.type = new messages_1.RegistrationType(NotebookDocumentSyncRegistrationType2.method);
    })(NotebookDocumentSyncRegistrationType || (exports.NotebookDocumentSyncRegistrationType = NotebookDocumentSyncRegistrationType = {}));
    var DidOpenNotebookDocumentNotification;
    (function(DidOpenNotebookDocumentNotification2) {
      DidOpenNotebookDocumentNotification2.method = "notebookDocument/didOpen";
      DidOpenNotebookDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidOpenNotebookDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidOpenNotebookDocumentNotification2.method);
      DidOpenNotebookDocumentNotification2.registrationMethod = NotebookDocumentSyncRegistrationType.method;
    })(DidOpenNotebookDocumentNotification || (exports.DidOpenNotebookDocumentNotification = DidOpenNotebookDocumentNotification = {}));
    var NotebookCellArrayChange;
    (function(NotebookCellArrayChange2) {
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && vscode_languageserver_types_1.uinteger.is(candidate.start) && vscode_languageserver_types_1.uinteger.is(candidate.deleteCount) && (candidate.cells === void 0 || Is.typedArray(candidate.cells, NotebookCell.is));
      }
      NotebookCellArrayChange2.is = is;
      function create(start, deleteCount, cells) {
        const result = { start, deleteCount };
        if (cells !== void 0) {
          result.cells = cells;
        }
        return result;
      }
      NotebookCellArrayChange2.create = create;
    })(NotebookCellArrayChange || (exports.NotebookCellArrayChange = NotebookCellArrayChange = {}));
    var DidChangeNotebookDocumentNotification;
    (function(DidChangeNotebookDocumentNotification2) {
      DidChangeNotebookDocumentNotification2.method = "notebookDocument/didChange";
      DidChangeNotebookDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidChangeNotebookDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidChangeNotebookDocumentNotification2.method);
      DidChangeNotebookDocumentNotification2.registrationMethod = NotebookDocumentSyncRegistrationType.method;
    })(DidChangeNotebookDocumentNotification || (exports.DidChangeNotebookDocumentNotification = DidChangeNotebookDocumentNotification = {}));
    var DidSaveNotebookDocumentNotification;
    (function(DidSaveNotebookDocumentNotification2) {
      DidSaveNotebookDocumentNotification2.method = "notebookDocument/didSave";
      DidSaveNotebookDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidSaveNotebookDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidSaveNotebookDocumentNotification2.method);
      DidSaveNotebookDocumentNotification2.registrationMethod = NotebookDocumentSyncRegistrationType.method;
    })(DidSaveNotebookDocumentNotification || (exports.DidSaveNotebookDocumentNotification = DidSaveNotebookDocumentNotification = {}));
    var DidCloseNotebookDocumentNotification;
    (function(DidCloseNotebookDocumentNotification2) {
      DidCloseNotebookDocumentNotification2.method = "notebookDocument/didClose";
      DidCloseNotebookDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidCloseNotebookDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidCloseNotebookDocumentNotification2.method);
      DidCloseNotebookDocumentNotification2.registrationMethod = NotebookDocumentSyncRegistrationType.method;
    })(DidCloseNotebookDocumentNotification || (exports.DidCloseNotebookDocumentNotification = DidCloseNotebookDocumentNotification = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineCompletion.js
var require_protocol_inlineCompletion = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.inlineCompletion.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineCompletionRequest = void 0;
    var messages_1 = require_messages2();
    var InlineCompletionRequest;
    (function(InlineCompletionRequest2) {
      InlineCompletionRequest2.method = "textDocument/inlineCompletion";
      InlineCompletionRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      InlineCompletionRequest2.type = new messages_1.ProtocolRequestType(InlineCompletionRequest2.method);
    })(InlineCompletionRequest || (exports.InlineCompletionRequest = InlineCompletionRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/protocol.js
var require_protocol = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/protocol.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WorkspaceSymbolRequest = exports.CodeActionResolveRequest = exports.CodeActionRequest = exports.DocumentSymbolRequest = exports.DocumentHighlightRequest = exports.ReferencesRequest = exports.DefinitionRequest = exports.SignatureHelpRequest = exports.SignatureHelpTriggerKind = exports.HoverRequest = exports.CompletionResolveRequest = exports.CompletionRequest = exports.CompletionTriggerKind = exports.PublishDiagnosticsNotification = exports.WatchKind = exports.RelativePattern = exports.FileChangeType = exports.DidChangeWatchedFilesNotification = exports.WillSaveTextDocumentWaitUntilRequest = exports.WillSaveTextDocumentNotification = exports.TextDocumentSaveReason = exports.DidSaveTextDocumentNotification = exports.DidCloseTextDocumentNotification = exports.DidChangeTextDocumentNotification = exports.TextDocumentContentChangeEvent = exports.DidOpenTextDocumentNotification = exports.TextDocumentSyncKind = exports.TelemetryEventNotification = exports.LogMessageNotification = exports.ShowMessageRequest = exports.ShowMessageNotification = exports.MessageType = exports.DidChangeConfigurationNotification = exports.ExitNotification = exports.ShutdownRequest = exports.InitializedNotification = exports.InitializeErrorCodes = exports.InitializeRequest = exports.WorkDoneProgressOptions = exports.TextDocumentRegistrationOptions = exports.StaticRegistrationOptions = exports.PositionEncodingKind = exports.FailureHandlingKind = exports.ResourceOperationKind = exports.UnregistrationRequest = exports.RegistrationRequest = exports.DocumentSelector = exports.NotebookCellTextDocumentFilter = exports.NotebookDocumentFilter = exports.TextDocumentFilter = void 0;
    exports.MonikerRequest = exports.MonikerKind = exports.UniquenessLevel = exports.WillDeleteFilesRequest = exports.DidDeleteFilesNotification = exports.WillRenameFilesRequest = exports.DidRenameFilesNotification = exports.WillCreateFilesRequest = exports.DidCreateFilesNotification = exports.FileOperationPatternKind = exports.LinkedEditingRangeRequest = exports.ShowDocumentRequest = exports.SemanticTokensRegistrationType = exports.SemanticTokensRefreshRequest = exports.SemanticTokensRangeRequest = exports.SemanticTokensDeltaRequest = exports.SemanticTokensRequest = exports.TokenFormat = exports.CallHierarchyPrepareRequest = exports.CallHierarchyOutgoingCallsRequest = exports.CallHierarchyIncomingCallsRequest = exports.WorkDoneProgressCancelNotification = exports.WorkDoneProgressCreateRequest = exports.WorkDoneProgress = exports.SelectionRangeRequest = exports.DeclarationRequest = exports.FoldingRangeRefreshRequest = exports.FoldingRangeRequest = exports.ColorPresentationRequest = exports.DocumentColorRequest = exports.ConfigurationRequest = exports.DidChangeWorkspaceFoldersNotification = exports.WorkspaceFoldersRequest = exports.TypeDefinitionRequest = exports.ImplementationRequest = exports.ApplyWorkspaceEditRequest = exports.ExecuteCommandRequest = exports.PrepareRenameRequest = exports.RenameRequest = exports.PrepareSupportDefaultBehavior = exports.DocumentOnTypeFormattingRequest = exports.DocumentRangesFormattingRequest = exports.DocumentRangeFormattingRequest = exports.DocumentFormattingRequest = exports.DocumentLinkResolveRequest = exports.DocumentLinkRequest = exports.CodeLensRefreshRequest = exports.CodeLensResolveRequest = exports.CodeLensRequest = exports.WorkspaceSymbolResolveRequest = void 0;
    exports.InlineCompletionRequest = exports.DidCloseNotebookDocumentNotification = exports.DidSaveNotebookDocumentNotification = exports.DidChangeNotebookDocumentNotification = exports.NotebookCellArrayChange = exports.DidOpenNotebookDocumentNotification = exports.NotebookDocumentSyncRegistrationType = exports.NotebookDocument = exports.NotebookCell = exports.ExecutionSummary = exports.NotebookCellKind = exports.DiagnosticRefreshRequest = exports.WorkspaceDiagnosticRequest = exports.DocumentDiagnosticRequest = exports.DocumentDiagnosticReportKind = exports.DiagnosticServerCancellationData = exports.InlayHintRefreshRequest = exports.InlayHintResolveRequest = exports.InlayHintRequest = exports.InlineValueRefreshRequest = exports.InlineValueRequest = exports.TypeHierarchySupertypesRequest = exports.TypeHierarchySubtypesRequest = exports.TypeHierarchyPrepareRequest = void 0;
    var messages_1 = require_messages2();
    var vscode_languageserver_types_1 = require_main2();
    var Is = require_is3();
    var protocol_implementation_1 = require_protocol_implementation();
    Object.defineProperty(exports, "ImplementationRequest", { enumerable: true, get: function() {
      return protocol_implementation_1.ImplementationRequest;
    } });
    var protocol_typeDefinition_1 = require_protocol_typeDefinition();
    Object.defineProperty(exports, "TypeDefinitionRequest", { enumerable: true, get: function() {
      return protocol_typeDefinition_1.TypeDefinitionRequest;
    } });
    var protocol_workspaceFolder_1 = require_protocol_workspaceFolder();
    Object.defineProperty(exports, "WorkspaceFoldersRequest", { enumerable: true, get: function() {
      return protocol_workspaceFolder_1.WorkspaceFoldersRequest;
    } });
    Object.defineProperty(exports, "DidChangeWorkspaceFoldersNotification", { enumerable: true, get: function() {
      return protocol_workspaceFolder_1.DidChangeWorkspaceFoldersNotification;
    } });
    var protocol_configuration_1 = require_protocol_configuration();
    Object.defineProperty(exports, "ConfigurationRequest", { enumerable: true, get: function() {
      return protocol_configuration_1.ConfigurationRequest;
    } });
    var protocol_colorProvider_1 = require_protocol_colorProvider();
    Object.defineProperty(exports, "DocumentColorRequest", { enumerable: true, get: function() {
      return protocol_colorProvider_1.DocumentColorRequest;
    } });
    Object.defineProperty(exports, "ColorPresentationRequest", { enumerable: true, get: function() {
      return protocol_colorProvider_1.ColorPresentationRequest;
    } });
    var protocol_foldingRange_1 = require_protocol_foldingRange();
    Object.defineProperty(exports, "FoldingRangeRequest", { enumerable: true, get: function() {
      return protocol_foldingRange_1.FoldingRangeRequest;
    } });
    Object.defineProperty(exports, "FoldingRangeRefreshRequest", { enumerable: true, get: function() {
      return protocol_foldingRange_1.FoldingRangeRefreshRequest;
    } });
    var protocol_declaration_1 = require_protocol_declaration();
    Object.defineProperty(exports, "DeclarationRequest", { enumerable: true, get: function() {
      return protocol_declaration_1.DeclarationRequest;
    } });
    var protocol_selectionRange_1 = require_protocol_selectionRange();
    Object.defineProperty(exports, "SelectionRangeRequest", { enumerable: true, get: function() {
      return protocol_selectionRange_1.SelectionRangeRequest;
    } });
    var protocol_progress_1 = require_protocol_progress();
    Object.defineProperty(exports, "WorkDoneProgress", { enumerable: true, get: function() {
      return protocol_progress_1.WorkDoneProgress;
    } });
    Object.defineProperty(exports, "WorkDoneProgressCreateRequest", { enumerable: true, get: function() {
      return protocol_progress_1.WorkDoneProgressCreateRequest;
    } });
    Object.defineProperty(exports, "WorkDoneProgressCancelNotification", { enumerable: true, get: function() {
      return protocol_progress_1.WorkDoneProgressCancelNotification;
    } });
    var protocol_callHierarchy_1 = require_protocol_callHierarchy();
    Object.defineProperty(exports, "CallHierarchyIncomingCallsRequest", { enumerable: true, get: function() {
      return protocol_callHierarchy_1.CallHierarchyIncomingCallsRequest;
    } });
    Object.defineProperty(exports, "CallHierarchyOutgoingCallsRequest", { enumerable: true, get: function() {
      return protocol_callHierarchy_1.CallHierarchyOutgoingCallsRequest;
    } });
    Object.defineProperty(exports, "CallHierarchyPrepareRequest", { enumerable: true, get: function() {
      return protocol_callHierarchy_1.CallHierarchyPrepareRequest;
    } });
    var protocol_semanticTokens_1 = require_protocol_semanticTokens();
    Object.defineProperty(exports, "TokenFormat", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.TokenFormat;
    } });
    Object.defineProperty(exports, "SemanticTokensRequest", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.SemanticTokensRequest;
    } });
    Object.defineProperty(exports, "SemanticTokensDeltaRequest", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.SemanticTokensDeltaRequest;
    } });
    Object.defineProperty(exports, "SemanticTokensRangeRequest", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.SemanticTokensRangeRequest;
    } });
    Object.defineProperty(exports, "SemanticTokensRefreshRequest", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.SemanticTokensRefreshRequest;
    } });
    Object.defineProperty(exports, "SemanticTokensRegistrationType", { enumerable: true, get: function() {
      return protocol_semanticTokens_1.SemanticTokensRegistrationType;
    } });
    var protocol_showDocument_1 = require_protocol_showDocument();
    Object.defineProperty(exports, "ShowDocumentRequest", { enumerable: true, get: function() {
      return protocol_showDocument_1.ShowDocumentRequest;
    } });
    var protocol_linkedEditingRange_1 = require_protocol_linkedEditingRange();
    Object.defineProperty(exports, "LinkedEditingRangeRequest", { enumerable: true, get: function() {
      return protocol_linkedEditingRange_1.LinkedEditingRangeRequest;
    } });
    var protocol_fileOperations_1 = require_protocol_fileOperations();
    Object.defineProperty(exports, "FileOperationPatternKind", { enumerable: true, get: function() {
      return protocol_fileOperations_1.FileOperationPatternKind;
    } });
    Object.defineProperty(exports, "DidCreateFilesNotification", { enumerable: true, get: function() {
      return protocol_fileOperations_1.DidCreateFilesNotification;
    } });
    Object.defineProperty(exports, "WillCreateFilesRequest", { enumerable: true, get: function() {
      return protocol_fileOperations_1.WillCreateFilesRequest;
    } });
    Object.defineProperty(exports, "DidRenameFilesNotification", { enumerable: true, get: function() {
      return protocol_fileOperations_1.DidRenameFilesNotification;
    } });
    Object.defineProperty(exports, "WillRenameFilesRequest", { enumerable: true, get: function() {
      return protocol_fileOperations_1.WillRenameFilesRequest;
    } });
    Object.defineProperty(exports, "DidDeleteFilesNotification", { enumerable: true, get: function() {
      return protocol_fileOperations_1.DidDeleteFilesNotification;
    } });
    Object.defineProperty(exports, "WillDeleteFilesRequest", { enumerable: true, get: function() {
      return protocol_fileOperations_1.WillDeleteFilesRequest;
    } });
    var protocol_moniker_1 = require_protocol_moniker();
    Object.defineProperty(exports, "UniquenessLevel", { enumerable: true, get: function() {
      return protocol_moniker_1.UniquenessLevel;
    } });
    Object.defineProperty(exports, "MonikerKind", { enumerable: true, get: function() {
      return protocol_moniker_1.MonikerKind;
    } });
    Object.defineProperty(exports, "MonikerRequest", { enumerable: true, get: function() {
      return protocol_moniker_1.MonikerRequest;
    } });
    var protocol_typeHierarchy_1 = require_protocol_typeHierarchy();
    Object.defineProperty(exports, "TypeHierarchyPrepareRequest", { enumerable: true, get: function() {
      return protocol_typeHierarchy_1.TypeHierarchyPrepareRequest;
    } });
    Object.defineProperty(exports, "TypeHierarchySubtypesRequest", { enumerable: true, get: function() {
      return protocol_typeHierarchy_1.TypeHierarchySubtypesRequest;
    } });
    Object.defineProperty(exports, "TypeHierarchySupertypesRequest", { enumerable: true, get: function() {
      return protocol_typeHierarchy_1.TypeHierarchySupertypesRequest;
    } });
    var protocol_inlineValue_1 = require_protocol_inlineValue();
    Object.defineProperty(exports, "InlineValueRequest", { enumerable: true, get: function() {
      return protocol_inlineValue_1.InlineValueRequest;
    } });
    Object.defineProperty(exports, "InlineValueRefreshRequest", { enumerable: true, get: function() {
      return protocol_inlineValue_1.InlineValueRefreshRequest;
    } });
    var protocol_inlayHint_1 = require_protocol_inlayHint();
    Object.defineProperty(exports, "InlayHintRequest", { enumerable: true, get: function() {
      return protocol_inlayHint_1.InlayHintRequest;
    } });
    Object.defineProperty(exports, "InlayHintResolveRequest", { enumerable: true, get: function() {
      return protocol_inlayHint_1.InlayHintResolveRequest;
    } });
    Object.defineProperty(exports, "InlayHintRefreshRequest", { enumerable: true, get: function() {
      return protocol_inlayHint_1.InlayHintRefreshRequest;
    } });
    var protocol_diagnostic_1 = require_protocol_diagnostic();
    Object.defineProperty(exports, "DiagnosticServerCancellationData", { enumerable: true, get: function() {
      return protocol_diagnostic_1.DiagnosticServerCancellationData;
    } });
    Object.defineProperty(exports, "DocumentDiagnosticReportKind", { enumerable: true, get: function() {
      return protocol_diagnostic_1.DocumentDiagnosticReportKind;
    } });
    Object.defineProperty(exports, "DocumentDiagnosticRequest", { enumerable: true, get: function() {
      return protocol_diagnostic_1.DocumentDiagnosticRequest;
    } });
    Object.defineProperty(exports, "WorkspaceDiagnosticRequest", { enumerable: true, get: function() {
      return protocol_diagnostic_1.WorkspaceDiagnosticRequest;
    } });
    Object.defineProperty(exports, "DiagnosticRefreshRequest", { enumerable: true, get: function() {
      return protocol_diagnostic_1.DiagnosticRefreshRequest;
    } });
    var protocol_notebook_1 = require_protocol_notebook();
    Object.defineProperty(exports, "NotebookCellKind", { enumerable: true, get: function() {
      return protocol_notebook_1.NotebookCellKind;
    } });
    Object.defineProperty(exports, "ExecutionSummary", { enumerable: true, get: function() {
      return protocol_notebook_1.ExecutionSummary;
    } });
    Object.defineProperty(exports, "NotebookCell", { enumerable: true, get: function() {
      return protocol_notebook_1.NotebookCell;
    } });
    Object.defineProperty(exports, "NotebookDocument", { enumerable: true, get: function() {
      return protocol_notebook_1.NotebookDocument;
    } });
    Object.defineProperty(exports, "NotebookDocumentSyncRegistrationType", { enumerable: true, get: function() {
      return protocol_notebook_1.NotebookDocumentSyncRegistrationType;
    } });
    Object.defineProperty(exports, "DidOpenNotebookDocumentNotification", { enumerable: true, get: function() {
      return protocol_notebook_1.DidOpenNotebookDocumentNotification;
    } });
    Object.defineProperty(exports, "NotebookCellArrayChange", { enumerable: true, get: function() {
      return protocol_notebook_1.NotebookCellArrayChange;
    } });
    Object.defineProperty(exports, "DidChangeNotebookDocumentNotification", { enumerable: true, get: function() {
      return protocol_notebook_1.DidChangeNotebookDocumentNotification;
    } });
    Object.defineProperty(exports, "DidSaveNotebookDocumentNotification", { enumerable: true, get: function() {
      return protocol_notebook_1.DidSaveNotebookDocumentNotification;
    } });
    Object.defineProperty(exports, "DidCloseNotebookDocumentNotification", { enumerable: true, get: function() {
      return protocol_notebook_1.DidCloseNotebookDocumentNotification;
    } });
    var protocol_inlineCompletion_1 = require_protocol_inlineCompletion();
    Object.defineProperty(exports, "InlineCompletionRequest", { enumerable: true, get: function() {
      return protocol_inlineCompletion_1.InlineCompletionRequest;
    } });
    var TextDocumentFilter;
    (function(TextDocumentFilter2) {
      function is(value) {
        const candidate = value;
        return Is.string(candidate) || (Is.string(candidate.language) || Is.string(candidate.scheme) || Is.string(candidate.pattern));
      }
      TextDocumentFilter2.is = is;
    })(TextDocumentFilter || (exports.TextDocumentFilter = TextDocumentFilter = {}));
    var NotebookDocumentFilter;
    (function(NotebookDocumentFilter2) {
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && (Is.string(candidate.notebookType) || Is.string(candidate.scheme) || Is.string(candidate.pattern));
      }
      NotebookDocumentFilter2.is = is;
    })(NotebookDocumentFilter || (exports.NotebookDocumentFilter = NotebookDocumentFilter = {}));
    var NotebookCellTextDocumentFilter;
    (function(NotebookCellTextDocumentFilter2) {
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && (Is.string(candidate.notebook) || NotebookDocumentFilter.is(candidate.notebook)) && (candidate.language === void 0 || Is.string(candidate.language));
      }
      NotebookCellTextDocumentFilter2.is = is;
    })(NotebookCellTextDocumentFilter || (exports.NotebookCellTextDocumentFilter = NotebookCellTextDocumentFilter = {}));
    var DocumentSelector;
    (function(DocumentSelector2) {
      function is(value) {
        if (!Array.isArray(value)) {
          return false;
        }
        for (let elem of value) {
          if (!Is.string(elem) && !TextDocumentFilter.is(elem) && !NotebookCellTextDocumentFilter.is(elem)) {
            return false;
          }
        }
        return true;
      }
      DocumentSelector2.is = is;
    })(DocumentSelector || (exports.DocumentSelector = DocumentSelector = {}));
    var RegistrationRequest;
    (function(RegistrationRequest2) {
      RegistrationRequest2.method = "client/registerCapability";
      RegistrationRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      RegistrationRequest2.type = new messages_1.ProtocolRequestType(RegistrationRequest2.method);
    })(RegistrationRequest || (exports.RegistrationRequest = RegistrationRequest = {}));
    var UnregistrationRequest;
    (function(UnregistrationRequest2) {
      UnregistrationRequest2.method = "client/unregisterCapability";
      UnregistrationRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      UnregistrationRequest2.type = new messages_1.ProtocolRequestType(UnregistrationRequest2.method);
    })(UnregistrationRequest || (exports.UnregistrationRequest = UnregistrationRequest = {}));
    var ResourceOperationKind;
    (function(ResourceOperationKind2) {
      ResourceOperationKind2.Create = "create";
      ResourceOperationKind2.Rename = "rename";
      ResourceOperationKind2.Delete = "delete";
    })(ResourceOperationKind || (exports.ResourceOperationKind = ResourceOperationKind = {}));
    var FailureHandlingKind;
    (function(FailureHandlingKind2) {
      FailureHandlingKind2.Abort = "abort";
      FailureHandlingKind2.Transactional = "transactional";
      FailureHandlingKind2.TextOnlyTransactional = "textOnlyTransactional";
      FailureHandlingKind2.Undo = "undo";
    })(FailureHandlingKind || (exports.FailureHandlingKind = FailureHandlingKind = {}));
    var PositionEncodingKind;
    (function(PositionEncodingKind2) {
      PositionEncodingKind2.UTF8 = "utf-8";
      PositionEncodingKind2.UTF16 = "utf-16";
      PositionEncodingKind2.UTF32 = "utf-32";
    })(PositionEncodingKind || (exports.PositionEncodingKind = PositionEncodingKind = {}));
    var StaticRegistrationOptions;
    (function(StaticRegistrationOptions2) {
      function hasId(value) {
        const candidate = value;
        return candidate && Is.string(candidate.id) && candidate.id.length > 0;
      }
      StaticRegistrationOptions2.hasId = hasId;
    })(StaticRegistrationOptions || (exports.StaticRegistrationOptions = StaticRegistrationOptions = {}));
    var TextDocumentRegistrationOptions;
    (function(TextDocumentRegistrationOptions2) {
      function is(value) {
        const candidate = value;
        return candidate && (candidate.documentSelector === null || DocumentSelector.is(candidate.documentSelector));
      }
      TextDocumentRegistrationOptions2.is = is;
    })(TextDocumentRegistrationOptions || (exports.TextDocumentRegistrationOptions = TextDocumentRegistrationOptions = {}));
    var WorkDoneProgressOptions;
    (function(WorkDoneProgressOptions2) {
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && (candidate.workDoneProgress === void 0 || Is.boolean(candidate.workDoneProgress));
      }
      WorkDoneProgressOptions2.is = is;
      function hasWorkDoneProgress(value) {
        const candidate = value;
        return candidate && Is.boolean(candidate.workDoneProgress);
      }
      WorkDoneProgressOptions2.hasWorkDoneProgress = hasWorkDoneProgress;
    })(WorkDoneProgressOptions || (exports.WorkDoneProgressOptions = WorkDoneProgressOptions = {}));
    var InitializeRequest;
    (function(InitializeRequest2) {
      InitializeRequest2.method = "initialize";
      InitializeRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      InitializeRequest2.type = new messages_1.ProtocolRequestType(InitializeRequest2.method);
    })(InitializeRequest || (exports.InitializeRequest = InitializeRequest = {}));
    var InitializeErrorCodes;
    (function(InitializeErrorCodes2) {
      InitializeErrorCodes2.unknownProtocolVersion = 1;
    })(InitializeErrorCodes || (exports.InitializeErrorCodes = InitializeErrorCodes = {}));
    var InitializedNotification;
    (function(InitializedNotification2) {
      InitializedNotification2.method = "initialized";
      InitializedNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      InitializedNotification2.type = new messages_1.ProtocolNotificationType(InitializedNotification2.method);
    })(InitializedNotification || (exports.InitializedNotification = InitializedNotification = {}));
    var ShutdownRequest;
    (function(ShutdownRequest2) {
      ShutdownRequest2.method = "shutdown";
      ShutdownRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      ShutdownRequest2.type = new messages_1.ProtocolRequestType0(ShutdownRequest2.method);
    })(ShutdownRequest || (exports.ShutdownRequest = ShutdownRequest = {}));
    var ExitNotification;
    (function(ExitNotification2) {
      ExitNotification2.method = "exit";
      ExitNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      ExitNotification2.type = new messages_1.ProtocolNotificationType0(ExitNotification2.method);
    })(ExitNotification || (exports.ExitNotification = ExitNotification = {}));
    var DidChangeConfigurationNotification2;
    (function(DidChangeConfigurationNotification3) {
      DidChangeConfigurationNotification3.method = "workspace/didChangeConfiguration";
      DidChangeConfigurationNotification3.messageDirection = messages_1.MessageDirection.clientToServer;
      DidChangeConfigurationNotification3.type = new messages_1.ProtocolNotificationType(DidChangeConfigurationNotification3.method);
    })(DidChangeConfigurationNotification2 || (exports.DidChangeConfigurationNotification = DidChangeConfigurationNotification2 = {}));
    var MessageType;
    (function(MessageType2) {
      MessageType2.Error = 1;
      MessageType2.Warning = 2;
      MessageType2.Info = 3;
      MessageType2.Log = 4;
      MessageType2.Debug = 5;
    })(MessageType || (exports.MessageType = MessageType = {}));
    var ShowMessageNotification;
    (function(ShowMessageNotification2) {
      ShowMessageNotification2.method = "window/showMessage";
      ShowMessageNotification2.messageDirection = messages_1.MessageDirection.serverToClient;
      ShowMessageNotification2.type = new messages_1.ProtocolNotificationType(ShowMessageNotification2.method);
    })(ShowMessageNotification || (exports.ShowMessageNotification = ShowMessageNotification = {}));
    var ShowMessageRequest;
    (function(ShowMessageRequest2) {
      ShowMessageRequest2.method = "window/showMessageRequest";
      ShowMessageRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      ShowMessageRequest2.type = new messages_1.ProtocolRequestType(ShowMessageRequest2.method);
    })(ShowMessageRequest || (exports.ShowMessageRequest = ShowMessageRequest = {}));
    var LogMessageNotification;
    (function(LogMessageNotification2) {
      LogMessageNotification2.method = "window/logMessage";
      LogMessageNotification2.messageDirection = messages_1.MessageDirection.serverToClient;
      LogMessageNotification2.type = new messages_1.ProtocolNotificationType(LogMessageNotification2.method);
    })(LogMessageNotification || (exports.LogMessageNotification = LogMessageNotification = {}));
    var TelemetryEventNotification;
    (function(TelemetryEventNotification2) {
      TelemetryEventNotification2.method = "telemetry/event";
      TelemetryEventNotification2.messageDirection = messages_1.MessageDirection.serverToClient;
      TelemetryEventNotification2.type = new messages_1.ProtocolNotificationType(TelemetryEventNotification2.method);
    })(TelemetryEventNotification || (exports.TelemetryEventNotification = TelemetryEventNotification = {}));
    var TextDocumentSyncKind2;
    (function(TextDocumentSyncKind3) {
      TextDocumentSyncKind3.None = 0;
      TextDocumentSyncKind3.Full = 1;
      TextDocumentSyncKind3.Incremental = 2;
    })(TextDocumentSyncKind2 || (exports.TextDocumentSyncKind = TextDocumentSyncKind2 = {}));
    var DidOpenTextDocumentNotification;
    (function(DidOpenTextDocumentNotification2) {
      DidOpenTextDocumentNotification2.method = "textDocument/didOpen";
      DidOpenTextDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidOpenTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidOpenTextDocumentNotification2.method);
    })(DidOpenTextDocumentNotification || (exports.DidOpenTextDocumentNotification = DidOpenTextDocumentNotification = {}));
    var TextDocumentContentChangeEvent;
    (function(TextDocumentContentChangeEvent2) {
      function isIncremental(event) {
        let candidate = event;
        return candidate !== void 0 && candidate !== null && typeof candidate.text === "string" && candidate.range !== void 0 && (candidate.rangeLength === void 0 || typeof candidate.rangeLength === "number");
      }
      TextDocumentContentChangeEvent2.isIncremental = isIncremental;
      function isFull(event) {
        let candidate = event;
        return candidate !== void 0 && candidate !== null && typeof candidate.text === "string" && candidate.range === void 0 && candidate.rangeLength === void 0;
      }
      TextDocumentContentChangeEvent2.isFull = isFull;
    })(TextDocumentContentChangeEvent || (exports.TextDocumentContentChangeEvent = TextDocumentContentChangeEvent = {}));
    var DidChangeTextDocumentNotification;
    (function(DidChangeTextDocumentNotification2) {
      DidChangeTextDocumentNotification2.method = "textDocument/didChange";
      DidChangeTextDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidChangeTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidChangeTextDocumentNotification2.method);
    })(DidChangeTextDocumentNotification || (exports.DidChangeTextDocumentNotification = DidChangeTextDocumentNotification = {}));
    var DidCloseTextDocumentNotification;
    (function(DidCloseTextDocumentNotification2) {
      DidCloseTextDocumentNotification2.method = "textDocument/didClose";
      DidCloseTextDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidCloseTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidCloseTextDocumentNotification2.method);
    })(DidCloseTextDocumentNotification || (exports.DidCloseTextDocumentNotification = DidCloseTextDocumentNotification = {}));
    var DidSaveTextDocumentNotification;
    (function(DidSaveTextDocumentNotification2) {
      DidSaveTextDocumentNotification2.method = "textDocument/didSave";
      DidSaveTextDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidSaveTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(DidSaveTextDocumentNotification2.method);
    })(DidSaveTextDocumentNotification || (exports.DidSaveTextDocumentNotification = DidSaveTextDocumentNotification = {}));
    var TextDocumentSaveReason;
    (function(TextDocumentSaveReason2) {
      TextDocumentSaveReason2.Manual = 1;
      TextDocumentSaveReason2.AfterDelay = 2;
      TextDocumentSaveReason2.FocusOut = 3;
    })(TextDocumentSaveReason || (exports.TextDocumentSaveReason = TextDocumentSaveReason = {}));
    var WillSaveTextDocumentNotification;
    (function(WillSaveTextDocumentNotification2) {
      WillSaveTextDocumentNotification2.method = "textDocument/willSave";
      WillSaveTextDocumentNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      WillSaveTextDocumentNotification2.type = new messages_1.ProtocolNotificationType(WillSaveTextDocumentNotification2.method);
    })(WillSaveTextDocumentNotification || (exports.WillSaveTextDocumentNotification = WillSaveTextDocumentNotification = {}));
    var WillSaveTextDocumentWaitUntilRequest;
    (function(WillSaveTextDocumentWaitUntilRequest2) {
      WillSaveTextDocumentWaitUntilRequest2.method = "textDocument/willSaveWaitUntil";
      WillSaveTextDocumentWaitUntilRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WillSaveTextDocumentWaitUntilRequest2.type = new messages_1.ProtocolRequestType(WillSaveTextDocumentWaitUntilRequest2.method);
    })(WillSaveTextDocumentWaitUntilRequest || (exports.WillSaveTextDocumentWaitUntilRequest = WillSaveTextDocumentWaitUntilRequest = {}));
    var DidChangeWatchedFilesNotification;
    (function(DidChangeWatchedFilesNotification2) {
      DidChangeWatchedFilesNotification2.method = "workspace/didChangeWatchedFiles";
      DidChangeWatchedFilesNotification2.messageDirection = messages_1.MessageDirection.clientToServer;
      DidChangeWatchedFilesNotification2.type = new messages_1.ProtocolNotificationType(DidChangeWatchedFilesNotification2.method);
    })(DidChangeWatchedFilesNotification || (exports.DidChangeWatchedFilesNotification = DidChangeWatchedFilesNotification = {}));
    var FileChangeType;
    (function(FileChangeType2) {
      FileChangeType2.Created = 1;
      FileChangeType2.Changed = 2;
      FileChangeType2.Deleted = 3;
    })(FileChangeType || (exports.FileChangeType = FileChangeType = {}));
    var RelativePattern;
    (function(RelativePattern2) {
      function is(value) {
        const candidate = value;
        return Is.objectLiteral(candidate) && (vscode_languageserver_types_1.URI.is(candidate.baseUri) || vscode_languageserver_types_1.WorkspaceFolder.is(candidate.baseUri)) && Is.string(candidate.pattern);
      }
      RelativePattern2.is = is;
    })(RelativePattern || (exports.RelativePattern = RelativePattern = {}));
    var WatchKind;
    (function(WatchKind2) {
      WatchKind2.Create = 1;
      WatchKind2.Change = 2;
      WatchKind2.Delete = 4;
    })(WatchKind || (exports.WatchKind = WatchKind = {}));
    var PublishDiagnosticsNotification;
    (function(PublishDiagnosticsNotification2) {
      PublishDiagnosticsNotification2.method = "textDocument/publishDiagnostics";
      PublishDiagnosticsNotification2.messageDirection = messages_1.MessageDirection.serverToClient;
      PublishDiagnosticsNotification2.type = new messages_1.ProtocolNotificationType(PublishDiagnosticsNotification2.method);
    })(PublishDiagnosticsNotification || (exports.PublishDiagnosticsNotification = PublishDiagnosticsNotification = {}));
    var CompletionTriggerKind;
    (function(CompletionTriggerKind2) {
      CompletionTriggerKind2.Invoked = 1;
      CompletionTriggerKind2.TriggerCharacter = 2;
      CompletionTriggerKind2.TriggerForIncompleteCompletions = 3;
    })(CompletionTriggerKind || (exports.CompletionTriggerKind = CompletionTriggerKind = {}));
    var CompletionRequest;
    (function(CompletionRequest2) {
      CompletionRequest2.method = "textDocument/completion";
      CompletionRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CompletionRequest2.type = new messages_1.ProtocolRequestType(CompletionRequest2.method);
    })(CompletionRequest || (exports.CompletionRequest = CompletionRequest = {}));
    var CompletionResolveRequest;
    (function(CompletionResolveRequest2) {
      CompletionResolveRequest2.method = "completionItem/resolve";
      CompletionResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CompletionResolveRequest2.type = new messages_1.ProtocolRequestType(CompletionResolveRequest2.method);
    })(CompletionResolveRequest || (exports.CompletionResolveRequest = CompletionResolveRequest = {}));
    var HoverRequest;
    (function(HoverRequest2) {
      HoverRequest2.method = "textDocument/hover";
      HoverRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      HoverRequest2.type = new messages_1.ProtocolRequestType(HoverRequest2.method);
    })(HoverRequest || (exports.HoverRequest = HoverRequest = {}));
    var SignatureHelpTriggerKind;
    (function(SignatureHelpTriggerKind2) {
      SignatureHelpTriggerKind2.Invoked = 1;
      SignatureHelpTriggerKind2.TriggerCharacter = 2;
      SignatureHelpTriggerKind2.ContentChange = 3;
    })(SignatureHelpTriggerKind || (exports.SignatureHelpTriggerKind = SignatureHelpTriggerKind = {}));
    var SignatureHelpRequest;
    (function(SignatureHelpRequest2) {
      SignatureHelpRequest2.method = "textDocument/signatureHelp";
      SignatureHelpRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      SignatureHelpRequest2.type = new messages_1.ProtocolRequestType(SignatureHelpRequest2.method);
    })(SignatureHelpRequest || (exports.SignatureHelpRequest = SignatureHelpRequest = {}));
    var DefinitionRequest;
    (function(DefinitionRequest2) {
      DefinitionRequest2.method = "textDocument/definition";
      DefinitionRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DefinitionRequest2.type = new messages_1.ProtocolRequestType(DefinitionRequest2.method);
    })(DefinitionRequest || (exports.DefinitionRequest = DefinitionRequest = {}));
    var ReferencesRequest;
    (function(ReferencesRequest2) {
      ReferencesRequest2.method = "textDocument/references";
      ReferencesRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      ReferencesRequest2.type = new messages_1.ProtocolRequestType(ReferencesRequest2.method);
    })(ReferencesRequest || (exports.ReferencesRequest = ReferencesRequest = {}));
    var DocumentHighlightRequest;
    (function(DocumentHighlightRequest2) {
      DocumentHighlightRequest2.method = "textDocument/documentHighlight";
      DocumentHighlightRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentHighlightRequest2.type = new messages_1.ProtocolRequestType(DocumentHighlightRequest2.method);
    })(DocumentHighlightRequest || (exports.DocumentHighlightRequest = DocumentHighlightRequest = {}));
    var DocumentSymbolRequest;
    (function(DocumentSymbolRequest2) {
      DocumentSymbolRequest2.method = "textDocument/documentSymbol";
      DocumentSymbolRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentSymbolRequest2.type = new messages_1.ProtocolRequestType(DocumentSymbolRequest2.method);
    })(DocumentSymbolRequest || (exports.DocumentSymbolRequest = DocumentSymbolRequest = {}));
    var CodeActionRequest;
    (function(CodeActionRequest2) {
      CodeActionRequest2.method = "textDocument/codeAction";
      CodeActionRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CodeActionRequest2.type = new messages_1.ProtocolRequestType(CodeActionRequest2.method);
    })(CodeActionRequest || (exports.CodeActionRequest = CodeActionRequest = {}));
    var CodeActionResolveRequest;
    (function(CodeActionResolveRequest2) {
      CodeActionResolveRequest2.method = "codeAction/resolve";
      CodeActionResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CodeActionResolveRequest2.type = new messages_1.ProtocolRequestType(CodeActionResolveRequest2.method);
    })(CodeActionResolveRequest || (exports.CodeActionResolveRequest = CodeActionResolveRequest = {}));
    var WorkspaceSymbolRequest;
    (function(WorkspaceSymbolRequest2) {
      WorkspaceSymbolRequest2.method = "workspace/symbol";
      WorkspaceSymbolRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WorkspaceSymbolRequest2.type = new messages_1.ProtocolRequestType(WorkspaceSymbolRequest2.method);
    })(WorkspaceSymbolRequest || (exports.WorkspaceSymbolRequest = WorkspaceSymbolRequest = {}));
    var WorkspaceSymbolResolveRequest;
    (function(WorkspaceSymbolResolveRequest2) {
      WorkspaceSymbolResolveRequest2.method = "workspaceSymbol/resolve";
      WorkspaceSymbolResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      WorkspaceSymbolResolveRequest2.type = new messages_1.ProtocolRequestType(WorkspaceSymbolResolveRequest2.method);
    })(WorkspaceSymbolResolveRequest || (exports.WorkspaceSymbolResolveRequest = WorkspaceSymbolResolveRequest = {}));
    var CodeLensRequest;
    (function(CodeLensRequest2) {
      CodeLensRequest2.method = "textDocument/codeLens";
      CodeLensRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CodeLensRequest2.type = new messages_1.ProtocolRequestType(CodeLensRequest2.method);
    })(CodeLensRequest || (exports.CodeLensRequest = CodeLensRequest = {}));
    var CodeLensResolveRequest;
    (function(CodeLensResolveRequest2) {
      CodeLensResolveRequest2.method = "codeLens/resolve";
      CodeLensResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      CodeLensResolveRequest2.type = new messages_1.ProtocolRequestType(CodeLensResolveRequest2.method);
    })(CodeLensResolveRequest || (exports.CodeLensResolveRequest = CodeLensResolveRequest = {}));
    var CodeLensRefreshRequest;
    (function(CodeLensRefreshRequest2) {
      CodeLensRefreshRequest2.method = `workspace/codeLens/refresh`;
      CodeLensRefreshRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      CodeLensRefreshRequest2.type = new messages_1.ProtocolRequestType0(CodeLensRefreshRequest2.method);
    })(CodeLensRefreshRequest || (exports.CodeLensRefreshRequest = CodeLensRefreshRequest = {}));
    var DocumentLinkRequest;
    (function(DocumentLinkRequest2) {
      DocumentLinkRequest2.method = "textDocument/documentLink";
      DocumentLinkRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentLinkRequest2.type = new messages_1.ProtocolRequestType(DocumentLinkRequest2.method);
    })(DocumentLinkRequest || (exports.DocumentLinkRequest = DocumentLinkRequest = {}));
    var DocumentLinkResolveRequest;
    (function(DocumentLinkResolveRequest2) {
      DocumentLinkResolveRequest2.method = "documentLink/resolve";
      DocumentLinkResolveRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentLinkResolveRequest2.type = new messages_1.ProtocolRequestType(DocumentLinkResolveRequest2.method);
    })(DocumentLinkResolveRequest || (exports.DocumentLinkResolveRequest = DocumentLinkResolveRequest = {}));
    var DocumentFormattingRequest;
    (function(DocumentFormattingRequest2) {
      DocumentFormattingRequest2.method = "textDocument/formatting";
      DocumentFormattingRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentFormattingRequest2.method);
    })(DocumentFormattingRequest || (exports.DocumentFormattingRequest = DocumentFormattingRequest = {}));
    var DocumentRangeFormattingRequest;
    (function(DocumentRangeFormattingRequest2) {
      DocumentRangeFormattingRequest2.method = "textDocument/rangeFormatting";
      DocumentRangeFormattingRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentRangeFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentRangeFormattingRequest2.method);
    })(DocumentRangeFormattingRequest || (exports.DocumentRangeFormattingRequest = DocumentRangeFormattingRequest = {}));
    var DocumentRangesFormattingRequest;
    (function(DocumentRangesFormattingRequest2) {
      DocumentRangesFormattingRequest2.method = "textDocument/rangesFormatting";
      DocumentRangesFormattingRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentRangesFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentRangesFormattingRequest2.method);
    })(DocumentRangesFormattingRequest || (exports.DocumentRangesFormattingRequest = DocumentRangesFormattingRequest = {}));
    var DocumentOnTypeFormattingRequest;
    (function(DocumentOnTypeFormattingRequest2) {
      DocumentOnTypeFormattingRequest2.method = "textDocument/onTypeFormatting";
      DocumentOnTypeFormattingRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      DocumentOnTypeFormattingRequest2.type = new messages_1.ProtocolRequestType(DocumentOnTypeFormattingRequest2.method);
    })(DocumentOnTypeFormattingRequest || (exports.DocumentOnTypeFormattingRequest = DocumentOnTypeFormattingRequest = {}));
    var PrepareSupportDefaultBehavior;
    (function(PrepareSupportDefaultBehavior2) {
      PrepareSupportDefaultBehavior2.Identifier = 1;
    })(PrepareSupportDefaultBehavior || (exports.PrepareSupportDefaultBehavior = PrepareSupportDefaultBehavior = {}));
    var RenameRequest;
    (function(RenameRequest2) {
      RenameRequest2.method = "textDocument/rename";
      RenameRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      RenameRequest2.type = new messages_1.ProtocolRequestType(RenameRequest2.method);
    })(RenameRequest || (exports.RenameRequest = RenameRequest = {}));
    var PrepareRenameRequest;
    (function(PrepareRenameRequest2) {
      PrepareRenameRequest2.method = "textDocument/prepareRename";
      PrepareRenameRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      PrepareRenameRequest2.type = new messages_1.ProtocolRequestType(PrepareRenameRequest2.method);
    })(PrepareRenameRequest || (exports.PrepareRenameRequest = PrepareRenameRequest = {}));
    var ExecuteCommandRequest;
    (function(ExecuteCommandRequest2) {
      ExecuteCommandRequest2.method = "workspace/executeCommand";
      ExecuteCommandRequest2.messageDirection = messages_1.MessageDirection.clientToServer;
      ExecuteCommandRequest2.type = new messages_1.ProtocolRequestType(ExecuteCommandRequest2.method);
    })(ExecuteCommandRequest || (exports.ExecuteCommandRequest = ExecuteCommandRequest = {}));
    var ApplyWorkspaceEditRequest;
    (function(ApplyWorkspaceEditRequest2) {
      ApplyWorkspaceEditRequest2.method = "workspace/applyEdit";
      ApplyWorkspaceEditRequest2.messageDirection = messages_1.MessageDirection.serverToClient;
      ApplyWorkspaceEditRequest2.type = new messages_1.ProtocolRequestType("workspace/applyEdit");
    })(ApplyWorkspaceEditRequest || (exports.ApplyWorkspaceEditRequest = ApplyWorkspaceEditRequest = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/connection.js
var require_connection2 = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/connection.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createProtocolConnection = void 0;
    var vscode_jsonrpc_1 = require_main();
    function createProtocolConnection(input, output, logger, options) {
      if (vscode_jsonrpc_1.ConnectionStrategy.is(options)) {
        options = { connectionStrategy: options };
      }
      return (0, vscode_jsonrpc_1.createMessageConnection)(input, output, logger, options);
    }
    exports.createProtocolConnection = createProtocolConnection;
  }
});

// node_modules/vscode-languageserver-protocol/lib/common/api.js
var require_api2 = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/common/api.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LSPErrorCodes = exports.createProtocolConnection = void 0;
    __exportStar(require_main(), exports);
    __exportStar(require_main2(), exports);
    __exportStar(require_messages2(), exports);
    __exportStar(require_protocol(), exports);
    var connection_1 = require_connection2();
    Object.defineProperty(exports, "createProtocolConnection", { enumerable: true, get: function() {
      return connection_1.createProtocolConnection;
    } });
    var LSPErrorCodes;
    (function(LSPErrorCodes2) {
      LSPErrorCodes2.lspReservedErrorRangeStart = -32899;
      LSPErrorCodes2.RequestFailed = -32803;
      LSPErrorCodes2.ServerCancelled = -32802;
      LSPErrorCodes2.ContentModified = -32801;
      LSPErrorCodes2.RequestCancelled = -32800;
      LSPErrorCodes2.lspReservedErrorRangeEnd = -32800;
    })(LSPErrorCodes || (exports.LSPErrorCodes = LSPErrorCodes = {}));
  }
});

// node_modules/vscode-languageserver-protocol/lib/node/main.js
var require_main3 = __commonJS({
  "node_modules/vscode-languageserver-protocol/lib/node/main.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createProtocolConnection = void 0;
    var node_1 = require_node();
    __exportStar(require_node(), exports);
    __exportStar(require_api2(), exports);
    function createProtocolConnection(input, output, logger, options) {
      return (0, node_1.createMessageConnection)(input, output, logger, options);
    }
    exports.createProtocolConnection = createProtocolConnection;
  }
});

// node_modules/vscode-languageserver/lib/common/utils/uuid.js
var require_uuid = __commonJS({
  "node_modules/vscode-languageserver/lib/common/utils/uuid.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateUuid = exports.parse = exports.isUUID = exports.v4 = exports.empty = void 0;
    var ValueUUID = class {
      constructor(_value) {
        this._value = _value;
      }
      asHex() {
        return this._value;
      }
      equals(other) {
        return this.asHex() === other.asHex();
      }
    };
    var V4UUID = class _V4UUID extends ValueUUID {
      static _oneOf(array) {
        return array[Math.floor(array.length * Math.random())];
      }
      static _randomHex() {
        return _V4UUID._oneOf(_V4UUID._chars);
      }
      constructor() {
        super([
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          "-",
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          "-",
          "4",
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          "-",
          _V4UUID._oneOf(_V4UUID._timeHighBits),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          "-",
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex(),
          _V4UUID._randomHex()
        ].join(""));
      }
    };
    V4UUID._chars = ["0", "1", "2", "3", "4", "5", "6", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    V4UUID._timeHighBits = ["8", "9", "a", "b"];
    exports.empty = new ValueUUID("00000000-0000-0000-0000-000000000000");
    function v4() {
      return new V4UUID();
    }
    exports.v4 = v4;
    var _UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function isUUID(value) {
      return _UUIDPattern.test(value);
    }
    exports.isUUID = isUUID;
    function parse(value) {
      if (!isUUID(value)) {
        throw new Error("invalid uuid");
      }
      return new ValueUUID(value);
    }
    exports.parse = parse;
    function generateUuid() {
      return v4().asHex();
    }
    exports.generateUuid = generateUuid;
  }
});

// node_modules/vscode-languageserver/lib/common/progress.js
var require_progress = __commonJS({
  "node_modules/vscode-languageserver/lib/common/progress.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.attachPartialResult = exports.ProgressFeature = exports.attachWorkDone = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var uuid_1 = require_uuid();
    var WorkDoneProgressReporterImpl = class _WorkDoneProgressReporterImpl {
      constructor(_connection, _token) {
        this._connection = _connection;
        this._token = _token;
        _WorkDoneProgressReporterImpl.Instances.set(this._token, this);
      }
      begin(title, percentage, message, cancellable) {
        let param = {
          kind: "begin",
          title,
          percentage,
          message,
          cancellable
        };
        this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, param);
      }
      report(arg0, arg1) {
        let param = {
          kind: "report"
        };
        if (typeof arg0 === "number") {
          param.percentage = arg0;
          if (arg1 !== void 0) {
            param.message = arg1;
          }
        } else {
          param.message = arg0;
        }
        this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, param);
      }
      done() {
        _WorkDoneProgressReporterImpl.Instances.delete(this._token);
        this._connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this._token, { kind: "end" });
      }
    };
    WorkDoneProgressReporterImpl.Instances = /* @__PURE__ */ new Map();
    var WorkDoneProgressServerReporterImpl = class extends WorkDoneProgressReporterImpl {
      constructor(connection2, token) {
        super(connection2, token);
        this._source = new vscode_languageserver_protocol_1.CancellationTokenSource();
      }
      get token() {
        return this._source.token;
      }
      done() {
        this._source.dispose();
        super.done();
      }
      cancel() {
        this._source.cancel();
      }
    };
    var NullProgressReporter = class {
      constructor() {
      }
      begin() {
      }
      report() {
      }
      done() {
      }
    };
    var NullProgressServerReporter = class extends NullProgressReporter {
      constructor() {
        super();
        this._source = new vscode_languageserver_protocol_1.CancellationTokenSource();
      }
      get token() {
        return this._source.token;
      }
      done() {
        this._source.dispose();
      }
      cancel() {
        this._source.cancel();
      }
    };
    function attachWorkDone(connection2, params) {
      if (params === void 0 || params.workDoneToken === void 0) {
        return new NullProgressReporter();
      }
      const token = params.workDoneToken;
      delete params.workDoneToken;
      return new WorkDoneProgressReporterImpl(connection2, token);
    }
    exports.attachWorkDone = attachWorkDone;
    var ProgressFeature = (Base) => {
      return class extends Base {
        constructor() {
          super();
          this._progressSupported = false;
        }
        initialize(capabilities) {
          super.initialize(capabilities);
          if (capabilities?.window?.workDoneProgress === true) {
            this._progressSupported = true;
            this.connection.onNotification(vscode_languageserver_protocol_1.WorkDoneProgressCancelNotification.type, (params) => {
              let progress = WorkDoneProgressReporterImpl.Instances.get(params.token);
              if (progress instanceof WorkDoneProgressServerReporterImpl || progress instanceof NullProgressServerReporter) {
                progress.cancel();
              }
            });
          }
        }
        attachWorkDoneProgress(token) {
          if (token === void 0) {
            return new NullProgressReporter();
          } else {
            return new WorkDoneProgressReporterImpl(this.connection, token);
          }
        }
        createWorkDoneProgress() {
          if (this._progressSupported) {
            const token = (0, uuid_1.generateUuid)();
            return this.connection.sendRequest(vscode_languageserver_protocol_1.WorkDoneProgressCreateRequest.type, { token }).then(() => {
              const result = new WorkDoneProgressServerReporterImpl(this.connection, token);
              return result;
            });
          } else {
            return Promise.resolve(new NullProgressServerReporter());
          }
        }
      };
    };
    exports.ProgressFeature = ProgressFeature;
    var ResultProgress;
    (function(ResultProgress2) {
      ResultProgress2.type = new vscode_languageserver_protocol_1.ProgressType();
    })(ResultProgress || (ResultProgress = {}));
    var ResultProgressReporterImpl = class {
      constructor(_connection, _token) {
        this._connection = _connection;
        this._token = _token;
      }
      report(data) {
        this._connection.sendProgress(ResultProgress.type, this._token, data);
      }
    };
    function attachPartialResult(connection2, params) {
      if (params === void 0 || params.partialResultToken === void 0) {
        return void 0;
      }
      const token = params.partialResultToken;
      delete params.partialResultToken;
      return new ResultProgressReporterImpl(connection2, token);
    }
    exports.attachPartialResult = attachPartialResult;
  }
});

// node_modules/vscode-languageserver/lib/common/configuration.js
var require_configuration = __commonJS({
  "node_modules/vscode-languageserver/lib/common/configuration.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConfigurationFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var Is = require_is();
    var ConfigurationFeature = (Base) => {
      return class extends Base {
        getConfiguration(arg) {
          if (!arg) {
            return this._getConfiguration({});
          } else if (Is.string(arg)) {
            return this._getConfiguration({ section: arg });
          } else {
            return this._getConfiguration(arg);
          }
        }
        _getConfiguration(arg) {
          let params = {
            items: Array.isArray(arg) ? arg : [arg]
          };
          return this.connection.sendRequest(vscode_languageserver_protocol_1.ConfigurationRequest.type, params).then((result) => {
            if (Array.isArray(result)) {
              return Array.isArray(arg) ? result : result[0];
            } else {
              return Array.isArray(arg) ? [] : null;
            }
          });
        }
      };
    };
    exports.ConfigurationFeature = ConfigurationFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/workspaceFolder.js
var require_workspaceFolder = __commonJS({
  "node_modules/vscode-languageserver/lib/common/workspaceFolder.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WorkspaceFoldersFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var WorkspaceFoldersFeature = (Base) => {
      return class extends Base {
        constructor() {
          super();
          this._notificationIsAutoRegistered = false;
        }
        initialize(capabilities) {
          super.initialize(capabilities);
          let workspaceCapabilities = capabilities.workspace;
          if (workspaceCapabilities && workspaceCapabilities.workspaceFolders) {
            this._onDidChangeWorkspaceFolders = new vscode_languageserver_protocol_1.Emitter();
            this.connection.onNotification(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type, (params) => {
              this._onDidChangeWorkspaceFolders.fire(params.event);
            });
          }
        }
        fillServerCapabilities(capabilities) {
          super.fillServerCapabilities(capabilities);
          const changeNotifications = capabilities.workspace?.workspaceFolders?.changeNotifications;
          this._notificationIsAutoRegistered = changeNotifications === true || typeof changeNotifications === "string";
        }
        getWorkspaceFolders() {
          return this.connection.sendRequest(vscode_languageserver_protocol_1.WorkspaceFoldersRequest.type);
        }
        get onDidChangeWorkspaceFolders() {
          if (!this._onDidChangeWorkspaceFolders) {
            throw new Error("Client doesn't support sending workspace folder change events.");
          }
          if (!this._notificationIsAutoRegistered && !this._unregistration) {
            this._unregistration = this.connection.client.register(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type);
          }
          return this._onDidChangeWorkspaceFolders.event;
        }
      };
    };
    exports.WorkspaceFoldersFeature = WorkspaceFoldersFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/callHierarchy.js
var require_callHierarchy = __commonJS({
  "node_modules/vscode-languageserver/lib/common/callHierarchy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CallHierarchyFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var CallHierarchyFeature = (Base) => {
      return class extends Base {
        get callHierarchy() {
          return {
            onPrepare: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.CallHierarchyPrepareRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), void 0);
              });
            },
            onIncomingCalls: (handler) => {
              const type = vscode_languageserver_protocol_1.CallHierarchyIncomingCallsRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            },
            onOutgoingCalls: (handler) => {
              const type = vscode_languageserver_protocol_1.CallHierarchyOutgoingCallsRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            }
          };
        }
      };
    };
    exports.CallHierarchyFeature = CallHierarchyFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/semanticTokens.js
var require_semanticTokens = __commonJS({
  "node_modules/vscode-languageserver/lib/common/semanticTokens.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SemanticTokensBuilder = exports.SemanticTokensDiff = exports.SemanticTokensFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var SemanticTokensFeature = (Base) => {
      return class extends Base {
        get semanticTokens() {
          return {
            refresh: () => {
              return this.connection.sendRequest(vscode_languageserver_protocol_1.SemanticTokensRefreshRequest.type);
            },
            on: (handler) => {
              const type = vscode_languageserver_protocol_1.SemanticTokensRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            },
            onDelta: (handler) => {
              const type = vscode_languageserver_protocol_1.SemanticTokensDeltaRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            },
            onRange: (handler) => {
              const type = vscode_languageserver_protocol_1.SemanticTokensRangeRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            }
          };
        }
      };
    };
    exports.SemanticTokensFeature = SemanticTokensFeature;
    var SemanticTokensDiff = class {
      constructor(originalSequence, modifiedSequence) {
        this.originalSequence = originalSequence;
        this.modifiedSequence = modifiedSequence;
      }
      computeDiff() {
        const originalLength = this.originalSequence.length;
        const modifiedLength = this.modifiedSequence.length;
        let startIndex = 0;
        while (startIndex < modifiedLength && startIndex < originalLength && this.originalSequence[startIndex] === this.modifiedSequence[startIndex]) {
          startIndex++;
        }
        if (startIndex < modifiedLength && startIndex < originalLength) {
          let originalEndIndex = originalLength - 1;
          let modifiedEndIndex = modifiedLength - 1;
          while (originalEndIndex >= startIndex && modifiedEndIndex >= startIndex && this.originalSequence[originalEndIndex] === this.modifiedSequence[modifiedEndIndex]) {
            originalEndIndex--;
            modifiedEndIndex--;
          }
          if (originalEndIndex < startIndex || modifiedEndIndex < startIndex) {
            originalEndIndex++;
            modifiedEndIndex++;
          }
          const deleteCount = originalEndIndex - startIndex + 1;
          const newData = this.modifiedSequence.slice(startIndex, modifiedEndIndex + 1);
          if (newData.length === 1 && newData[0] === this.originalSequence[originalEndIndex]) {
            return [
              { start: startIndex, deleteCount: deleteCount - 1 }
            ];
          } else {
            return [
              { start: startIndex, deleteCount, data: newData }
            ];
          }
        } else if (startIndex < modifiedLength) {
          return [
            { start: startIndex, deleteCount: 0, data: this.modifiedSequence.slice(startIndex) }
          ];
        } else if (startIndex < originalLength) {
          return [
            { start: startIndex, deleteCount: originalLength - startIndex }
          ];
        } else {
          return [];
        }
      }
    };
    exports.SemanticTokensDiff = SemanticTokensDiff;
    var SemanticTokensBuilder2 = class {
      constructor() {
        this._prevData = void 0;
        this.initialize();
      }
      initialize() {
        this._id = Date.now();
        this._prevLine = 0;
        this._prevChar = 0;
        this._data = [];
        this._dataLen = 0;
      }
      push(line, char, length, tokenType, tokenModifiers) {
        let pushLine = line;
        let pushChar = char;
        if (this._dataLen > 0) {
          pushLine -= this._prevLine;
          if (pushLine === 0) {
            pushChar -= this._prevChar;
          }
        }
        this._data[this._dataLen++] = pushLine;
        this._data[this._dataLen++] = pushChar;
        this._data[this._dataLen++] = length;
        this._data[this._dataLen++] = tokenType;
        this._data[this._dataLen++] = tokenModifiers;
        this._prevLine = line;
        this._prevChar = char;
      }
      get id() {
        return this._id.toString();
      }
      previousResult(id) {
        if (this.id === id) {
          this._prevData = this._data;
        }
        this.initialize();
      }
      build() {
        this._prevData = void 0;
        return {
          resultId: this.id,
          data: this._data
        };
      }
      canBuildEdits() {
        return this._prevData !== void 0;
      }
      buildEdits() {
        if (this._prevData !== void 0) {
          return {
            resultId: this.id,
            edits: new SemanticTokensDiff(this._prevData, this._data).computeDiff()
          };
        } else {
          return this.build();
        }
      }
    };
    exports.SemanticTokensBuilder = SemanticTokensBuilder2;
  }
});

// node_modules/vscode-languageserver/lib/common/showDocument.js
var require_showDocument = __commonJS({
  "node_modules/vscode-languageserver/lib/common/showDocument.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ShowDocumentFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var ShowDocumentFeature = (Base) => {
      return class extends Base {
        showDocument(params) {
          return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowDocumentRequest.type, params);
        }
      };
    };
    exports.ShowDocumentFeature = ShowDocumentFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/fileOperations.js
var require_fileOperations = __commonJS({
  "node_modules/vscode-languageserver/lib/common/fileOperations.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FileOperationsFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var FileOperationsFeature = (Base) => {
      return class extends Base {
        onDidCreateFiles(handler) {
          return this.connection.onNotification(vscode_languageserver_protocol_1.DidCreateFilesNotification.type, (params) => {
            handler(params);
          });
        }
        onDidRenameFiles(handler) {
          return this.connection.onNotification(vscode_languageserver_protocol_1.DidRenameFilesNotification.type, (params) => {
            handler(params);
          });
        }
        onDidDeleteFiles(handler) {
          return this.connection.onNotification(vscode_languageserver_protocol_1.DidDeleteFilesNotification.type, (params) => {
            handler(params);
          });
        }
        onWillCreateFiles(handler) {
          return this.connection.onRequest(vscode_languageserver_protocol_1.WillCreateFilesRequest.type, (params, cancel) => {
            return handler(params, cancel);
          });
        }
        onWillRenameFiles(handler) {
          return this.connection.onRequest(vscode_languageserver_protocol_1.WillRenameFilesRequest.type, (params, cancel) => {
            return handler(params, cancel);
          });
        }
        onWillDeleteFiles(handler) {
          return this.connection.onRequest(vscode_languageserver_protocol_1.WillDeleteFilesRequest.type, (params, cancel) => {
            return handler(params, cancel);
          });
        }
      };
    };
    exports.FileOperationsFeature = FileOperationsFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/linkedEditingRange.js
var require_linkedEditingRange = __commonJS({
  "node_modules/vscode-languageserver/lib/common/linkedEditingRange.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LinkedEditingRangeFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var LinkedEditingRangeFeature = (Base) => {
      return class extends Base {
        onLinkedEditingRange(handler) {
          return this.connection.onRequest(vscode_languageserver_protocol_1.LinkedEditingRangeRequest.type, (params, cancel) => {
            return handler(params, cancel, this.attachWorkDoneProgress(params), void 0);
          });
        }
      };
    };
    exports.LinkedEditingRangeFeature = LinkedEditingRangeFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/typeHierarchy.js
var require_typeHierarchy = __commonJS({
  "node_modules/vscode-languageserver/lib/common/typeHierarchy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeHierarchyFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var TypeHierarchyFeature = (Base) => {
      return class extends Base {
        get typeHierarchy() {
          return {
            onPrepare: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.TypeHierarchyPrepareRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), void 0);
              });
            },
            onSupertypes: (handler) => {
              const type = vscode_languageserver_protocol_1.TypeHierarchySupertypesRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            },
            onSubtypes: (handler) => {
              const type = vscode_languageserver_protocol_1.TypeHierarchySubtypesRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            }
          };
        }
      };
    };
    exports.TypeHierarchyFeature = TypeHierarchyFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/inlineValue.js
var require_inlineValue = __commonJS({
  "node_modules/vscode-languageserver/lib/common/inlineValue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineValueFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var InlineValueFeature = (Base) => {
      return class extends Base {
        get inlineValue() {
          return {
            refresh: () => {
              return this.connection.sendRequest(vscode_languageserver_protocol_1.InlineValueRefreshRequest.type);
            },
            on: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.InlineValueRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params));
              });
            }
          };
        }
      };
    };
    exports.InlineValueFeature = InlineValueFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/foldingRange.js
var require_foldingRange = __commonJS({
  "node_modules/vscode-languageserver/lib/common/foldingRange.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FoldingRangeFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var FoldingRangeFeature = (Base) => {
      return class extends Base {
        get foldingRange() {
          return {
            refresh: () => {
              return this.connection.sendRequest(vscode_languageserver_protocol_1.FoldingRangeRefreshRequest.type);
            },
            on: (handler) => {
              const type = vscode_languageserver_protocol_1.FoldingRangeRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            }
          };
        }
      };
    };
    exports.FoldingRangeFeature = FoldingRangeFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/inlayHint.js
var require_inlayHint = __commonJS({
  "node_modules/vscode-languageserver/lib/common/inlayHint.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlayHintFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var InlayHintFeature = (Base) => {
      return class extends Base {
        get inlayHint() {
          return {
            refresh: () => {
              return this.connection.sendRequest(vscode_languageserver_protocol_1.InlayHintRefreshRequest.type);
            },
            on: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.InlayHintRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params));
              });
            },
            resolve: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.InlayHintResolveRequest.type, (params, cancel) => {
                return handler(params, cancel);
              });
            }
          };
        }
      };
    };
    exports.InlayHintFeature = InlayHintFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/diagnostic.js
var require_diagnostic = __commonJS({
  "node_modules/vscode-languageserver/lib/common/diagnostic.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiagnosticFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var DiagnosticFeature = (Base) => {
      return class extends Base {
        get diagnostics() {
          return {
            refresh: () => {
              return this.connection.sendRequest(vscode_languageserver_protocol_1.DiagnosticRefreshRequest.type);
            },
            on: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.DocumentDiagnosticRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(vscode_languageserver_protocol_1.DocumentDiagnosticRequest.partialResult, params));
              });
            },
            onWorkspace: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.WorkspaceDiagnosticRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(vscode_languageserver_protocol_1.WorkspaceDiagnosticRequest.partialResult, params));
              });
            }
          };
        }
      };
    };
    exports.DiagnosticFeature = DiagnosticFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/textDocuments.js
var require_textDocuments = __commonJS({
  "node_modules/vscode-languageserver/lib/common/textDocuments.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TextDocuments = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var TextDocuments2 = class {
      /**
       * Create a new text document manager.
       */
      constructor(configuration) {
        this._configuration = configuration;
        this._syncedDocuments = /* @__PURE__ */ new Map();
        this._onDidChangeContent = new vscode_languageserver_protocol_1.Emitter();
        this._onDidOpen = new vscode_languageserver_protocol_1.Emitter();
        this._onDidClose = new vscode_languageserver_protocol_1.Emitter();
        this._onDidSave = new vscode_languageserver_protocol_1.Emitter();
        this._onWillSave = new vscode_languageserver_protocol_1.Emitter();
      }
      /**
       * An event that fires when a text document managed by this manager
       * has been opened.
       */
      get onDidOpen() {
        return this._onDidOpen.event;
      }
      /**
       * An event that fires when a text document managed by this manager
       * has been opened or the content changes.
       */
      get onDidChangeContent() {
        return this._onDidChangeContent.event;
      }
      /**
       * An event that fires when a text document managed by this manager
       * will be saved.
       */
      get onWillSave() {
        return this._onWillSave.event;
      }
      /**
       * Sets a handler that will be called if a participant wants to provide
       * edits during a text document save.
       */
      onWillSaveWaitUntil(handler) {
        this._willSaveWaitUntil = handler;
      }
      /**
       * An event that fires when a text document managed by this manager
       * has been saved.
       */
      get onDidSave() {
        return this._onDidSave.event;
      }
      /**
       * An event that fires when a text document managed by this manager
       * has been closed.
       */
      get onDidClose() {
        return this._onDidClose.event;
      }
      /**
       * Returns the document for the given URI. Returns undefined if
       * the document is not managed by this instance.
       *
       * @param uri The text document's URI to retrieve.
       * @return the text document or `undefined`.
       */
      get(uri) {
        return this._syncedDocuments.get(uri);
      }
      /**
       * Returns all text documents managed by this instance.
       *
       * @return all text documents.
       */
      all() {
        return Array.from(this._syncedDocuments.values());
      }
      /**
       * Returns the URIs of all text documents managed by this instance.
       *
       * @return the URI's of all text documents.
       */
      keys() {
        return Array.from(this._syncedDocuments.keys());
      }
      /**
       * Listens for `low level` notification on the given connection to
       * update the text documents managed by this instance.
       *
       * Please note that the connection only provides handlers not an event model. Therefore
       * listening on a connection will overwrite the following handlers on a connection:
       * `onDidOpenTextDocument`, `onDidChangeTextDocument`, `onDidCloseTextDocument`,
       * `onWillSaveTextDocument`, `onWillSaveTextDocumentWaitUntil` and `onDidSaveTextDocument`.
       *
       * Use the corresponding events on the TextDocuments instance instead.
       *
       * @param connection The connection to listen on.
       */
      listen(connection2) {
        connection2.__textDocumentSync = vscode_languageserver_protocol_1.TextDocumentSyncKind.Incremental;
        const disposables = [];
        disposables.push(connection2.onDidOpenTextDocument((event) => {
          const td = event.textDocument;
          const document = this._configuration.create(td.uri, td.languageId, td.version, td.text);
          this._syncedDocuments.set(td.uri, document);
          const toFire = Object.freeze({ document });
          this._onDidOpen.fire(toFire);
          this._onDidChangeContent.fire(toFire);
        }));
        disposables.push(connection2.onDidChangeTextDocument((event) => {
          const td = event.textDocument;
          const changes = event.contentChanges;
          if (changes.length === 0) {
            return;
          }
          const { version } = td;
          if (version === null || version === void 0) {
            throw new Error(`Received document change event for ${td.uri} without valid version identifier`);
          }
          let syncedDocument = this._syncedDocuments.get(td.uri);
          if (syncedDocument !== void 0) {
            syncedDocument = this._configuration.update(syncedDocument, changes, version);
            this._syncedDocuments.set(td.uri, syncedDocument);
            this._onDidChangeContent.fire(Object.freeze({ document: syncedDocument }));
          }
        }));
        disposables.push(connection2.onDidCloseTextDocument((event) => {
          let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
          if (syncedDocument !== void 0) {
            this._syncedDocuments.delete(event.textDocument.uri);
            this._onDidClose.fire(Object.freeze({ document: syncedDocument }));
          }
        }));
        disposables.push(connection2.onWillSaveTextDocument((event) => {
          let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
          if (syncedDocument !== void 0) {
            this._onWillSave.fire(Object.freeze({ document: syncedDocument, reason: event.reason }));
          }
        }));
        disposables.push(connection2.onWillSaveTextDocumentWaitUntil((event, token) => {
          let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
          if (syncedDocument !== void 0 && this._willSaveWaitUntil) {
            return this._willSaveWaitUntil(Object.freeze({ document: syncedDocument, reason: event.reason }), token);
          } else {
            return [];
          }
        }));
        disposables.push(connection2.onDidSaveTextDocument((event) => {
          let syncedDocument = this._syncedDocuments.get(event.textDocument.uri);
          if (syncedDocument !== void 0) {
            this._onDidSave.fire(Object.freeze({ document: syncedDocument }));
          }
        }));
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          disposables.forEach((disposable) => disposable.dispose());
        });
      }
    };
    exports.TextDocuments = TextDocuments2;
  }
});

// node_modules/vscode-languageserver/lib/common/notebook.js
var require_notebook = __commonJS({
  "node_modules/vscode-languageserver/lib/common/notebook.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NotebookDocuments = exports.NotebookSyncFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var textDocuments_1 = require_textDocuments();
    var NotebookSyncFeature = (Base) => {
      return class extends Base {
        get synchronization() {
          return {
            onDidOpenNotebookDocument: (handler) => {
              return this.connection.onNotification(vscode_languageserver_protocol_1.DidOpenNotebookDocumentNotification.type, (params) => {
                handler(params);
              });
            },
            onDidChangeNotebookDocument: (handler) => {
              return this.connection.onNotification(vscode_languageserver_protocol_1.DidChangeNotebookDocumentNotification.type, (params) => {
                handler(params);
              });
            },
            onDidSaveNotebookDocument: (handler) => {
              return this.connection.onNotification(vscode_languageserver_protocol_1.DidSaveNotebookDocumentNotification.type, (params) => {
                handler(params);
              });
            },
            onDidCloseNotebookDocument: (handler) => {
              return this.connection.onNotification(vscode_languageserver_protocol_1.DidCloseNotebookDocumentNotification.type, (params) => {
                handler(params);
              });
            }
          };
        }
      };
    };
    exports.NotebookSyncFeature = NotebookSyncFeature;
    var CellTextDocumentConnection = class _CellTextDocumentConnection {
      onDidOpenTextDocument(handler) {
        this.openHandler = handler;
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          this.openHandler = void 0;
        });
      }
      openTextDocument(params) {
        this.openHandler && this.openHandler(params);
      }
      onDidChangeTextDocument(handler) {
        this.changeHandler = handler;
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          this.changeHandler = handler;
        });
      }
      changeTextDocument(params) {
        this.changeHandler && this.changeHandler(params);
      }
      onDidCloseTextDocument(handler) {
        this.closeHandler = handler;
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          this.closeHandler = void 0;
        });
      }
      closeTextDocument(params) {
        this.closeHandler && this.closeHandler(params);
      }
      onWillSaveTextDocument() {
        return _CellTextDocumentConnection.NULL_DISPOSE;
      }
      onWillSaveTextDocumentWaitUntil() {
        return _CellTextDocumentConnection.NULL_DISPOSE;
      }
      onDidSaveTextDocument() {
        return _CellTextDocumentConnection.NULL_DISPOSE;
      }
    };
    CellTextDocumentConnection.NULL_DISPOSE = Object.freeze({ dispose: () => {
    } });
    var NotebookDocuments = class {
      constructor(configurationOrTextDocuments) {
        if (configurationOrTextDocuments instanceof textDocuments_1.TextDocuments) {
          this._cellTextDocuments = configurationOrTextDocuments;
        } else {
          this._cellTextDocuments = new textDocuments_1.TextDocuments(configurationOrTextDocuments);
        }
        this.notebookDocuments = /* @__PURE__ */ new Map();
        this.notebookCellMap = /* @__PURE__ */ new Map();
        this._onDidOpen = new vscode_languageserver_protocol_1.Emitter();
        this._onDidChange = new vscode_languageserver_protocol_1.Emitter();
        this._onDidSave = new vscode_languageserver_protocol_1.Emitter();
        this._onDidClose = new vscode_languageserver_protocol_1.Emitter();
      }
      get cellTextDocuments() {
        return this._cellTextDocuments;
      }
      getCellTextDocument(cell) {
        return this._cellTextDocuments.get(cell.document);
      }
      getNotebookDocument(uri) {
        return this.notebookDocuments.get(uri);
      }
      getNotebookCell(uri) {
        const value = this.notebookCellMap.get(uri);
        return value && value[0];
      }
      findNotebookDocumentForCell(cell) {
        const key = typeof cell === "string" ? cell : cell.document;
        const value = this.notebookCellMap.get(key);
        return value && value[1];
      }
      get onDidOpen() {
        return this._onDidOpen.event;
      }
      get onDidSave() {
        return this._onDidSave.event;
      }
      get onDidChange() {
        return this._onDidChange.event;
      }
      get onDidClose() {
        return this._onDidClose.event;
      }
      /**
       * Listens for `low level` notification on the given connection to
       * update the notebook documents managed by this instance.
       *
       * Please note that the connection only provides handlers not an event model. Therefore
       * listening on a connection will overwrite the following handlers on a connection:
       * `onDidOpenNotebookDocument`, `onDidChangeNotebookDocument`, `onDidSaveNotebookDocument`,
       *  and `onDidCloseNotebookDocument`.
       *
       * @param connection The connection to listen on.
       */
      listen(connection2) {
        const cellTextDocumentConnection = new CellTextDocumentConnection();
        const disposables = [];
        disposables.push(this.cellTextDocuments.listen(cellTextDocumentConnection));
        disposables.push(connection2.notebooks.synchronization.onDidOpenNotebookDocument((params) => {
          this.notebookDocuments.set(params.notebookDocument.uri, params.notebookDocument);
          for (const cellTextDocument of params.cellTextDocuments) {
            cellTextDocumentConnection.openTextDocument({ textDocument: cellTextDocument });
          }
          this.updateCellMap(params.notebookDocument);
          this._onDidOpen.fire(params.notebookDocument);
        }));
        disposables.push(connection2.notebooks.synchronization.onDidChangeNotebookDocument((params) => {
          const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
          if (notebookDocument === void 0) {
            return;
          }
          notebookDocument.version = params.notebookDocument.version;
          const oldMetadata = notebookDocument.metadata;
          let metadataChanged = false;
          const change = params.change;
          if (change.metadata !== void 0) {
            metadataChanged = true;
            notebookDocument.metadata = change.metadata;
          }
          const opened = [];
          const closed = [];
          const data = [];
          const text = [];
          if (change.cells !== void 0) {
            const changedCells = change.cells;
            if (changedCells.structure !== void 0) {
              const array = changedCells.structure.array;
              notebookDocument.cells.splice(array.start, array.deleteCount, ...array.cells !== void 0 ? array.cells : []);
              if (changedCells.structure.didOpen !== void 0) {
                for (const open of changedCells.structure.didOpen) {
                  cellTextDocumentConnection.openTextDocument({ textDocument: open });
                  opened.push(open.uri);
                }
              }
              if (changedCells.structure.didClose) {
                for (const close of changedCells.structure.didClose) {
                  cellTextDocumentConnection.closeTextDocument({ textDocument: close });
                  closed.push(close.uri);
                }
              }
            }
            if (changedCells.data !== void 0) {
              const cellUpdates = new Map(changedCells.data.map((cell) => [cell.document, cell]));
              for (let i = 0; i <= notebookDocument.cells.length; i++) {
                const change2 = cellUpdates.get(notebookDocument.cells[i].document);
                if (change2 !== void 0) {
                  const old = notebookDocument.cells.splice(i, 1, change2);
                  data.push({ old: old[0], new: change2 });
                  cellUpdates.delete(change2.document);
                  if (cellUpdates.size === 0) {
                    break;
                  }
                }
              }
            }
            if (changedCells.textContent !== void 0) {
              for (const cellTextDocument of changedCells.textContent) {
                cellTextDocumentConnection.changeTextDocument({ textDocument: cellTextDocument.document, contentChanges: cellTextDocument.changes });
                text.push(cellTextDocument.document.uri);
              }
            }
          }
          this.updateCellMap(notebookDocument);
          const changeEvent = { notebookDocument };
          if (metadataChanged) {
            changeEvent.metadata = { old: oldMetadata, new: notebookDocument.metadata };
          }
          const added = [];
          for (const open of opened) {
            added.push(this.getNotebookCell(open));
          }
          const removed = [];
          for (const close of closed) {
            removed.push(this.getNotebookCell(close));
          }
          const textContent = [];
          for (const change2 of text) {
            textContent.push(this.getNotebookCell(change2));
          }
          if (added.length > 0 || removed.length > 0 || data.length > 0 || textContent.length > 0) {
            changeEvent.cells = { added, removed, changed: { data, textContent } };
          }
          if (changeEvent.metadata !== void 0 || changeEvent.cells !== void 0) {
            this._onDidChange.fire(changeEvent);
          }
        }));
        disposables.push(connection2.notebooks.synchronization.onDidSaveNotebookDocument((params) => {
          const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
          if (notebookDocument === void 0) {
            return;
          }
          this._onDidSave.fire(notebookDocument);
        }));
        disposables.push(connection2.notebooks.synchronization.onDidCloseNotebookDocument((params) => {
          const notebookDocument = this.notebookDocuments.get(params.notebookDocument.uri);
          if (notebookDocument === void 0) {
            return;
          }
          this._onDidClose.fire(notebookDocument);
          for (const cellTextDocument of params.cellTextDocuments) {
            cellTextDocumentConnection.closeTextDocument({ textDocument: cellTextDocument });
          }
          this.notebookDocuments.delete(params.notebookDocument.uri);
          for (const cell of notebookDocument.cells) {
            this.notebookCellMap.delete(cell.document);
          }
        }));
        return vscode_languageserver_protocol_1.Disposable.create(() => {
          disposables.forEach((disposable) => disposable.dispose());
        });
      }
      updateCellMap(notebookDocument) {
        for (const cell of notebookDocument.cells) {
          this.notebookCellMap.set(cell.document, [cell, notebookDocument]);
        }
      }
    };
    exports.NotebookDocuments = NotebookDocuments;
  }
});

// node_modules/vscode-languageserver/lib/common/moniker.js
var require_moniker = __commonJS({
  "node_modules/vscode-languageserver/lib/common/moniker.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MonikerFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var MonikerFeature = (Base) => {
      return class extends Base {
        get moniker() {
          return {
            on: (handler) => {
              const type = vscode_languageserver_protocol_1.MonikerRequest.type;
              return this.connection.onRequest(type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params), this.attachPartialResultProgress(type, params));
              });
            }
          };
        }
      };
    };
    exports.MonikerFeature = MonikerFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/server.js
var require_server = __commonJS({
  "node_modules/vscode-languageserver/lib/common/server.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createConnection = exports.combineFeatures = exports.combineNotebooksFeatures = exports.combineLanguagesFeatures = exports.combineWorkspaceFeatures = exports.combineWindowFeatures = exports.combineClientFeatures = exports.combineTracerFeatures = exports.combineTelemetryFeatures = exports.combineConsoleFeatures = exports._NotebooksImpl = exports._LanguagesImpl = exports.BulkUnregistration = exports.BulkRegistration = exports.ErrorMessageTracker = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var Is = require_is();
    var UUID = require_uuid();
    var progress_1 = require_progress();
    var configuration_1 = require_configuration();
    var workspaceFolder_1 = require_workspaceFolder();
    var callHierarchy_1 = require_callHierarchy();
    var semanticTokens_1 = require_semanticTokens();
    var showDocument_1 = require_showDocument();
    var fileOperations_1 = require_fileOperations();
    var linkedEditingRange_1 = require_linkedEditingRange();
    var typeHierarchy_1 = require_typeHierarchy();
    var inlineValue_1 = require_inlineValue();
    var foldingRange_1 = require_foldingRange();
    var inlayHint_1 = require_inlayHint();
    var diagnostic_1 = require_diagnostic();
    var notebook_1 = require_notebook();
    var moniker_1 = require_moniker();
    function null2Undefined(value) {
      if (value === null) {
        return void 0;
      }
      return value;
    }
    var ErrorMessageTracker = class {
      constructor() {
        this._messages = /* @__PURE__ */ Object.create(null);
      }
      /**
       * Add a message to the tracker.
       *
       * @param message The message to add.
       */
      add(message) {
        let count = this._messages[message];
        if (!count) {
          count = 0;
        }
        count++;
        this._messages[message] = count;
      }
      /**
       * Send all tracked messages to the connection's window.
       *
       * @param connection The connection established between client and server.
       */
      sendErrors(connection2) {
        Object.keys(this._messages).forEach((message) => {
          connection2.window.showErrorMessage(message);
        });
      }
    };
    exports.ErrorMessageTracker = ErrorMessageTracker;
    var RemoteConsoleImpl = class {
      constructor() {
      }
      rawAttach(connection2) {
        this._rawConnection = connection2;
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      fillServerCapabilities(_capabilities) {
      }
      initialize(_capabilities) {
      }
      error(message) {
        this.send(vscode_languageserver_protocol_1.MessageType.Error, message);
      }
      warn(message) {
        this.send(vscode_languageserver_protocol_1.MessageType.Warning, message);
      }
      info(message) {
        this.send(vscode_languageserver_protocol_1.MessageType.Info, message);
      }
      log(message) {
        this.send(vscode_languageserver_protocol_1.MessageType.Log, message);
      }
      debug(message) {
        this.send(vscode_languageserver_protocol_1.MessageType.Debug, message);
      }
      send(type, message) {
        if (this._rawConnection) {
          this._rawConnection.sendNotification(vscode_languageserver_protocol_1.LogMessageNotification.type, { type, message }).catch(() => {
            (0, vscode_languageserver_protocol_1.RAL)().console.error(`Sending log message failed`);
          });
        }
      }
    };
    var _RemoteWindowImpl = class {
      constructor() {
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      showErrorMessage(message, ...actions) {
        let params = { type: vscode_languageserver_protocol_1.MessageType.Error, message, actions };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
      }
      showWarningMessage(message, ...actions) {
        let params = { type: vscode_languageserver_protocol_1.MessageType.Warning, message, actions };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
      }
      showInformationMessage(message, ...actions) {
        let params = { type: vscode_languageserver_protocol_1.MessageType.Info, message, actions };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ShowMessageRequest.type, params).then(null2Undefined);
      }
    };
    var RemoteWindowImpl = (0, showDocument_1.ShowDocumentFeature)((0, progress_1.ProgressFeature)(_RemoteWindowImpl));
    var BulkRegistration;
    (function(BulkRegistration2) {
      function create() {
        return new BulkRegistrationImpl();
      }
      BulkRegistration2.create = create;
    })(BulkRegistration || (exports.BulkRegistration = BulkRegistration = {}));
    var BulkRegistrationImpl = class {
      constructor() {
        this._registrations = [];
        this._registered = /* @__PURE__ */ new Set();
      }
      add(type, registerOptions) {
        const method = Is.string(type) ? type : type.method;
        if (this._registered.has(method)) {
          throw new Error(`${method} is already added to this registration`);
        }
        const id = UUID.generateUuid();
        this._registrations.push({
          id,
          method,
          registerOptions: registerOptions || {}
        });
        this._registered.add(method);
      }
      asRegistrationParams() {
        return {
          registrations: this._registrations
        };
      }
    };
    var BulkUnregistration;
    (function(BulkUnregistration2) {
      function create() {
        return new BulkUnregistrationImpl(void 0, []);
      }
      BulkUnregistration2.create = create;
    })(BulkUnregistration || (exports.BulkUnregistration = BulkUnregistration = {}));
    var BulkUnregistrationImpl = class {
      constructor(_connection, unregistrations) {
        this._connection = _connection;
        this._unregistrations = /* @__PURE__ */ new Map();
        unregistrations.forEach((unregistration) => {
          this._unregistrations.set(unregistration.method, unregistration);
        });
      }
      get isAttached() {
        return !!this._connection;
      }
      attach(connection2) {
        this._connection = connection2;
      }
      add(unregistration) {
        this._unregistrations.set(unregistration.method, unregistration);
      }
      dispose() {
        let unregistrations = [];
        for (let unregistration of this._unregistrations.values()) {
          unregistrations.push(unregistration);
        }
        let params = {
          unregisterations: unregistrations
        };
        this._connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).catch(() => {
          this._connection.console.info(`Bulk unregistration failed.`);
        });
      }
      disposeSingle(arg) {
        const method = Is.string(arg) ? arg : arg.method;
        const unregistration = this._unregistrations.get(method);
        if (!unregistration) {
          return false;
        }
        let params = {
          unregisterations: [unregistration]
        };
        this._connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).then(() => {
          this._unregistrations.delete(method);
        }, (_error) => {
          this._connection.console.info(`Un-registering request handler for ${unregistration.id} failed.`);
        });
        return true;
      }
    };
    var RemoteClientImpl = class {
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      register(typeOrRegistrations, registerOptionsOrType, registerOptions) {
        if (typeOrRegistrations instanceof BulkRegistrationImpl) {
          return this.registerMany(typeOrRegistrations);
        } else if (typeOrRegistrations instanceof BulkUnregistrationImpl) {
          return this.registerSingle1(typeOrRegistrations, registerOptionsOrType, registerOptions);
        } else {
          return this.registerSingle2(typeOrRegistrations, registerOptionsOrType);
        }
      }
      registerSingle1(unregistration, type, registerOptions) {
        const method = Is.string(type) ? type : type.method;
        const id = UUID.generateUuid();
        let params = {
          registrations: [{ id, method, registerOptions: registerOptions || {} }]
        };
        if (!unregistration.isAttached) {
          unregistration.attach(this.connection);
        }
        return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then((_result) => {
          unregistration.add({ id, method });
          return unregistration;
        }, (_error) => {
          this.connection.console.info(`Registering request handler for ${method} failed.`);
          return Promise.reject(_error);
        });
      }
      registerSingle2(type, registerOptions) {
        const method = Is.string(type) ? type : type.method;
        const id = UUID.generateUuid();
        let params = {
          registrations: [{ id, method, registerOptions: registerOptions || {} }]
        };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then((_result) => {
          return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.unregisterSingle(id, method).catch(() => {
              this.connection.console.info(`Un-registering capability with id ${id} failed.`);
            });
          });
        }, (_error) => {
          this.connection.console.info(`Registering request handler for ${method} failed.`);
          return Promise.reject(_error);
        });
      }
      unregisterSingle(id, method) {
        let params = {
          unregisterations: [{ id, method }]
        };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, params).catch(() => {
          this.connection.console.info(`Un-registering request handler for ${id} failed.`);
        });
      }
      registerMany(registrations) {
        let params = registrations.asRegistrationParams();
        return this.connection.sendRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, params).then(() => {
          return new BulkUnregistrationImpl(this._connection, params.registrations.map((registration) => {
            return { id: registration.id, method: registration.method };
          }));
        }, (_error) => {
          this.connection.console.info(`Bulk registration failed.`);
          return Promise.reject(_error);
        });
      }
    };
    var _RemoteWorkspaceImpl = class {
      constructor() {
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      applyEdit(paramOrEdit) {
        function isApplyWorkspaceEditParams(value) {
          return value && !!value.edit;
        }
        let params = isApplyWorkspaceEditParams(paramOrEdit) ? paramOrEdit : { edit: paramOrEdit };
        return this.connection.sendRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, params);
      }
    };
    var RemoteWorkspaceImpl = (0, fileOperations_1.FileOperationsFeature)((0, workspaceFolder_1.WorkspaceFoldersFeature)((0, configuration_1.ConfigurationFeature)(_RemoteWorkspaceImpl)));
    var TracerImpl = class {
      constructor() {
        this._trace = vscode_languageserver_protocol_1.Trace.Off;
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      set trace(value) {
        this._trace = value;
      }
      log(message, verbose) {
        if (this._trace === vscode_languageserver_protocol_1.Trace.Off) {
          return;
        }
        this.connection.sendNotification(vscode_languageserver_protocol_1.LogTraceNotification.type, {
          message,
          verbose: this._trace === vscode_languageserver_protocol_1.Trace.Verbose ? verbose : void 0
        }).catch(() => {
        });
      }
    };
    var TelemetryImpl = class {
      constructor() {
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      logEvent(data) {
        this.connection.sendNotification(vscode_languageserver_protocol_1.TelemetryEventNotification.type, data).catch(() => {
          this.connection.console.log(`Sending TelemetryEventNotification failed`);
        });
      }
    };
    var _LanguagesImpl = class {
      constructor() {
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      attachWorkDoneProgress(params) {
        return (0, progress_1.attachWorkDone)(this.connection, params);
      }
      attachPartialResultProgress(_type, params) {
        return (0, progress_1.attachPartialResult)(this.connection, params);
      }
    };
    exports._LanguagesImpl = _LanguagesImpl;
    var LanguagesImpl = (0, foldingRange_1.FoldingRangeFeature)((0, moniker_1.MonikerFeature)((0, diagnostic_1.DiagnosticFeature)((0, inlayHint_1.InlayHintFeature)((0, inlineValue_1.InlineValueFeature)((0, typeHierarchy_1.TypeHierarchyFeature)((0, linkedEditingRange_1.LinkedEditingRangeFeature)((0, semanticTokens_1.SemanticTokensFeature)((0, callHierarchy_1.CallHierarchyFeature)(_LanguagesImpl)))))))));
    var _NotebooksImpl = class {
      constructor() {
      }
      attach(connection2) {
        this._connection = connection2;
      }
      get connection() {
        if (!this._connection) {
          throw new Error("Remote is not attached to a connection yet.");
        }
        return this._connection;
      }
      initialize(_capabilities) {
      }
      fillServerCapabilities(_capabilities) {
      }
      attachWorkDoneProgress(params) {
        return (0, progress_1.attachWorkDone)(this.connection, params);
      }
      attachPartialResultProgress(_type, params) {
        return (0, progress_1.attachPartialResult)(this.connection, params);
      }
    };
    exports._NotebooksImpl = _NotebooksImpl;
    var NotebooksImpl = (0, notebook_1.NotebookSyncFeature)(_NotebooksImpl);
    function combineConsoleFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineConsoleFeatures = combineConsoleFeatures;
    function combineTelemetryFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineTelemetryFeatures = combineTelemetryFeatures;
    function combineTracerFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineTracerFeatures = combineTracerFeatures;
    function combineClientFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineClientFeatures = combineClientFeatures;
    function combineWindowFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineWindowFeatures = combineWindowFeatures;
    function combineWorkspaceFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineWorkspaceFeatures = combineWorkspaceFeatures;
    function combineLanguagesFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineLanguagesFeatures = combineLanguagesFeatures;
    function combineNotebooksFeatures(one, two) {
      return function(Base) {
        return two(one(Base));
      };
    }
    exports.combineNotebooksFeatures = combineNotebooksFeatures;
    function combineFeatures(one, two) {
      function combine(one2, two2, func) {
        if (one2 && two2) {
          return func(one2, two2);
        } else if (one2) {
          return one2;
        } else {
          return two2;
        }
      }
      let result = {
        __brand: "features",
        console: combine(one.console, two.console, combineConsoleFeatures),
        tracer: combine(one.tracer, two.tracer, combineTracerFeatures),
        telemetry: combine(one.telemetry, two.telemetry, combineTelemetryFeatures),
        client: combine(one.client, two.client, combineClientFeatures),
        window: combine(one.window, two.window, combineWindowFeatures),
        workspace: combine(one.workspace, two.workspace, combineWorkspaceFeatures),
        languages: combine(one.languages, two.languages, combineLanguagesFeatures),
        notebooks: combine(one.notebooks, two.notebooks, combineNotebooksFeatures)
      };
      return result;
    }
    exports.combineFeatures = combineFeatures;
    function createConnection2(connectionFactory, watchDog, factories) {
      const logger = factories && factories.console ? new (factories.console(RemoteConsoleImpl))() : new RemoteConsoleImpl();
      const connection2 = connectionFactory(logger);
      logger.rawAttach(connection2);
      const tracer = factories && factories.tracer ? new (factories.tracer(TracerImpl))() : new TracerImpl();
      const telemetry = factories && factories.telemetry ? new (factories.telemetry(TelemetryImpl))() : new TelemetryImpl();
      const client = factories && factories.client ? new (factories.client(RemoteClientImpl))() : new RemoteClientImpl();
      const remoteWindow = factories && factories.window ? new (factories.window(RemoteWindowImpl))() : new RemoteWindowImpl();
      const workspace = factories && factories.workspace ? new (factories.workspace(RemoteWorkspaceImpl))() : new RemoteWorkspaceImpl();
      const languages = factories && factories.languages ? new (factories.languages(LanguagesImpl))() : new LanguagesImpl();
      const notebooks = factories && factories.notebooks ? new (factories.notebooks(NotebooksImpl))() : new NotebooksImpl();
      const allRemotes = [logger, tracer, telemetry, client, remoteWindow, workspace, languages, notebooks];
      function asPromise(value) {
        if (value instanceof Promise) {
          return value;
        } else if (Is.thenable(value)) {
          return new Promise((resolve, reject) => {
            value.then((resolved) => resolve(resolved), (error) => reject(error));
          });
        } else {
          return Promise.resolve(value);
        }
      }
      let shutdownHandler = void 0;
      let initializeHandler = void 0;
      let exitHandler = void 0;
      let protocolConnection = {
        listen: () => connection2.listen(),
        sendRequest: (type, ...params) => connection2.sendRequest(Is.string(type) ? type : type.method, ...params),
        onRequest: (type, handler) => connection2.onRequest(type, handler),
        sendNotification: (type, param) => {
          const method = Is.string(type) ? type : type.method;
          return connection2.sendNotification(method, param);
        },
        onNotification: (type, handler) => connection2.onNotification(type, handler),
        onProgress: connection2.onProgress,
        sendProgress: connection2.sendProgress,
        onInitialize: (handler) => {
          initializeHandler = handler;
          return {
            dispose: () => {
              initializeHandler = void 0;
            }
          };
        },
        onInitialized: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.InitializedNotification.type, handler),
        onShutdown: (handler) => {
          shutdownHandler = handler;
          return {
            dispose: () => {
              shutdownHandler = void 0;
            }
          };
        },
        onExit: (handler) => {
          exitHandler = handler;
          return {
            dispose: () => {
              exitHandler = void 0;
            }
          };
        },
        get console() {
          return logger;
        },
        get telemetry() {
          return telemetry;
        },
        get tracer() {
          return tracer;
        },
        get client() {
          return client;
        },
        get window() {
          return remoteWindow;
        },
        get workspace() {
          return workspace;
        },
        get languages() {
          return languages;
        },
        get notebooks() {
          return notebooks;
        },
        onDidChangeConfiguration: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidChangeConfigurationNotification.type, handler),
        onDidChangeWatchedFiles: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidChangeWatchedFilesNotification.type, handler),
        __textDocumentSync: void 0,
        onDidOpenTextDocument: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, handler),
        onDidChangeTextDocument: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidChangeTextDocumentNotification.type, handler),
        onDidCloseTextDocument: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidCloseTextDocumentNotification.type, handler),
        onWillSaveTextDocument: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.WillSaveTextDocumentNotification.type, handler),
        onWillSaveTextDocumentWaitUntil: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.WillSaveTextDocumentWaitUntilRequest.type, handler),
        onDidSaveTextDocument: (handler) => connection2.onNotification(vscode_languageserver_protocol_1.DidSaveTextDocumentNotification.type, handler),
        sendDiagnostics: (params) => connection2.sendNotification(vscode_languageserver_protocol_1.PublishDiagnosticsNotification.type, params),
        onHover: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.HoverRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        onCompletion: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CompletionRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onCompletionResolve: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CompletionResolveRequest.type, handler),
        onSignatureHelp: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.SignatureHelpRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        onDeclaration: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DeclarationRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onDefinition: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DefinitionRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onTypeDefinition: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.TypeDefinitionRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onImplementation: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.ImplementationRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onReferences: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.ReferencesRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onDocumentHighlight: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentHighlightRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onDocumentSymbol: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onWorkspaceSymbol: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.WorkspaceSymbolRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onWorkspaceSymbolResolve: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.WorkspaceSymbolResolveRequest.type, handler),
        onCodeAction: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CodeActionRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onCodeActionResolve: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CodeActionResolveRequest.type, (params, cancel) => {
          return handler(params, cancel);
        }),
        onCodeLens: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CodeLensRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onCodeLensResolve: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.CodeLensResolveRequest.type, (params, cancel) => {
          return handler(params, cancel);
        }),
        onDocumentFormatting: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentFormattingRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        onDocumentRangeFormatting: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentRangeFormattingRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        onDocumentOnTypeFormatting: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentOnTypeFormattingRequest.type, (params, cancel) => {
          return handler(params, cancel);
        }),
        onRenameRequest: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.RenameRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        onPrepareRename: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.PrepareRenameRequest.type, (params, cancel) => {
          return handler(params, cancel);
        }),
        onDocumentLinks: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentLinkRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onDocumentLinkResolve: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentLinkResolveRequest.type, (params, cancel) => {
          return handler(params, cancel);
        }),
        onDocumentColor: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.DocumentColorRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onColorPresentation: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.ColorPresentationRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onFoldingRanges: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.FoldingRangeRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onSelectionRanges: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.SelectionRangeRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), (0, progress_1.attachPartialResult)(connection2, params));
        }),
        onExecuteCommand: (handler) => connection2.onRequest(vscode_languageserver_protocol_1.ExecuteCommandRequest.type, (params, cancel) => {
          return handler(params, cancel, (0, progress_1.attachWorkDone)(connection2, params), void 0);
        }),
        dispose: () => connection2.dispose()
      };
      for (let remote of allRemotes) {
        remote.attach(protocolConnection);
      }
      connection2.onRequest(vscode_languageserver_protocol_1.InitializeRequest.type, (params) => {
        watchDog.initialize(params);
        if (Is.string(params.trace)) {
          tracer.trace = vscode_languageserver_protocol_1.Trace.fromString(params.trace);
        }
        for (let remote of allRemotes) {
          remote.initialize(params.capabilities);
        }
        if (initializeHandler) {
          let result = initializeHandler(params, new vscode_languageserver_protocol_1.CancellationTokenSource().token, (0, progress_1.attachWorkDone)(connection2, params), void 0);
          return asPromise(result).then((value) => {
            if (value instanceof vscode_languageserver_protocol_1.ResponseError) {
              return value;
            }
            let result2 = value;
            if (!result2) {
              result2 = { capabilities: {} };
            }
            let capabilities = result2.capabilities;
            if (!capabilities) {
              capabilities = {};
              result2.capabilities = capabilities;
            }
            if (capabilities.textDocumentSync === void 0 || capabilities.textDocumentSync === null) {
              capabilities.textDocumentSync = Is.number(protocolConnection.__textDocumentSync) ? protocolConnection.__textDocumentSync : vscode_languageserver_protocol_1.TextDocumentSyncKind.None;
            } else if (!Is.number(capabilities.textDocumentSync) && !Is.number(capabilities.textDocumentSync.change)) {
              capabilities.textDocumentSync.change = Is.number(protocolConnection.__textDocumentSync) ? protocolConnection.__textDocumentSync : vscode_languageserver_protocol_1.TextDocumentSyncKind.None;
            }
            for (let remote of allRemotes) {
              remote.fillServerCapabilities(capabilities);
            }
            return result2;
          });
        } else {
          let result = { capabilities: { textDocumentSync: vscode_languageserver_protocol_1.TextDocumentSyncKind.None } };
          for (let remote of allRemotes) {
            remote.fillServerCapabilities(result.capabilities);
          }
          return result;
        }
      });
      connection2.onRequest(vscode_languageserver_protocol_1.ShutdownRequest.type, () => {
        watchDog.shutdownReceived = true;
        if (shutdownHandler) {
          return shutdownHandler(new vscode_languageserver_protocol_1.CancellationTokenSource().token);
        } else {
          return void 0;
        }
      });
      connection2.onNotification(vscode_languageserver_protocol_1.ExitNotification.type, () => {
        try {
          if (exitHandler) {
            exitHandler();
          }
        } finally {
          if (watchDog.shutdownReceived) {
            watchDog.exit(0);
          } else {
            watchDog.exit(1);
          }
        }
      });
      connection2.onNotification(vscode_languageserver_protocol_1.SetTraceNotification.type, (params) => {
        tracer.trace = vscode_languageserver_protocol_1.Trace.fromString(params.value);
      });
      return protocolConnection;
    }
    exports.createConnection = createConnection2;
  }
});

// node_modules/vscode-languageserver/lib/node/files.js
var require_files = __commonJS({
  "node_modules/vscode-languageserver/lib/node/files.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveModulePath = exports.FileSystem = exports.resolveGlobalYarnPath = exports.resolveGlobalNodePath = exports.resolve = exports.uriToFilePath = void 0;
    var url = __require("url");
    var path6 = __require("path");
    var fs4 = __require("fs");
    var child_process_1 = __require("child_process");
    function uriToFilePath(uri) {
      let parsed = url.parse(uri);
      if (parsed.protocol !== "file:" || !parsed.path) {
        return void 0;
      }
      let segments = parsed.path.split("/");
      for (var i = 0, len = segments.length; i < len; i++) {
        segments[i] = decodeURIComponent(segments[i]);
      }
      if (process.platform === "win32" && segments.length > 1) {
        let first = segments[0];
        let second = segments[1];
        if (first.length === 0 && second.length > 1 && second[1] === ":") {
          segments.shift();
        }
      }
      return path6.normalize(segments.join("/"));
    }
    exports.uriToFilePath = uriToFilePath;
    function isWindows() {
      return process.platform === "win32";
    }
    function resolve(moduleName, nodePath, cwd, tracer) {
      const nodePathKey = "NODE_PATH";
      const app = [
        "var p = process;",
        "p.on('message',function(m){",
        "if(m.c==='e'){",
        "p.exit(0);",
        "}",
        "else if(m.c==='rs'){",
        "try{",
        "var r=require.resolve(m.a);",
        "p.send({c:'r',s:true,r:r});",
        "}",
        "catch(err){",
        "p.send({c:'r',s:false});",
        "}",
        "}",
        "});"
      ].join("");
      return new Promise((resolve2, reject) => {
        let env = process.env;
        let newEnv = /* @__PURE__ */ Object.create(null);
        Object.keys(env).forEach((key) => newEnv[key] = env[key]);
        if (nodePath && fs4.existsSync(nodePath)) {
          if (newEnv[nodePathKey]) {
            newEnv[nodePathKey] = nodePath + path6.delimiter + newEnv[nodePathKey];
          } else {
            newEnv[nodePathKey] = nodePath;
          }
          if (tracer) {
            tracer(`NODE_PATH value is: ${newEnv[nodePathKey]}`);
          }
        }
        newEnv["ELECTRON_RUN_AS_NODE"] = "1";
        try {
          let cp = (0, child_process_1.fork)("", [], {
            cwd,
            env: newEnv,
            execArgv: ["-e", app]
          });
          if (cp.pid === void 0) {
            reject(new Error(`Starting process to resolve node module  ${moduleName} failed`));
            return;
          }
          cp.on("error", (error) => {
            reject(error);
          });
          cp.on("message", (message2) => {
            if (message2.c === "r") {
              cp.send({ c: "e" });
              if (message2.s) {
                resolve2(message2.r);
              } else {
                reject(new Error(`Failed to resolve module: ${moduleName}`));
              }
            }
          });
          let message = {
            c: "rs",
            a: moduleName
          };
          cp.send(message);
        } catch (error) {
          reject(error);
        }
      });
    }
    exports.resolve = resolve;
    function resolveGlobalNodePath(tracer) {
      let npmCommand = "npm";
      const env = /* @__PURE__ */ Object.create(null);
      Object.keys(process.env).forEach((key) => env[key] = process.env[key]);
      env["NO_UPDATE_NOTIFIER"] = "true";
      const options = {
        encoding: "utf8",
        env
      };
      if (isWindows()) {
        npmCommand = "npm.cmd";
        options.shell = true;
      }
      let handler = () => {
      };
      try {
        process.on("SIGPIPE", handler);
        let stdout = (0, child_process_1.spawnSync)(npmCommand, ["config", "get", "prefix"], options).stdout;
        if (!stdout) {
          if (tracer) {
            tracer(`'npm config get prefix' didn't return a value.`);
          }
          return void 0;
        }
        let prefix = stdout.trim();
        if (tracer) {
          tracer(`'npm config get prefix' value is: ${prefix}`);
        }
        if (prefix.length > 0) {
          if (isWindows()) {
            return path6.join(prefix, "node_modules");
          } else {
            return path6.join(prefix, "lib", "node_modules");
          }
        }
        return void 0;
      } catch (err) {
        return void 0;
      } finally {
        process.removeListener("SIGPIPE", handler);
      }
    }
    exports.resolveGlobalNodePath = resolveGlobalNodePath;
    function resolveGlobalYarnPath(tracer) {
      let yarnCommand = "yarn";
      let options = {
        encoding: "utf8"
      };
      if (isWindows()) {
        yarnCommand = "yarn.cmd";
        options.shell = true;
      }
      let handler = () => {
      };
      try {
        process.on("SIGPIPE", handler);
        let results = (0, child_process_1.spawnSync)(yarnCommand, ["global", "dir", "--json"], options);
        let stdout = results.stdout;
        if (!stdout) {
          if (tracer) {
            tracer(`'yarn global dir' didn't return a value.`);
            if (results.stderr) {
              tracer(results.stderr);
            }
          }
          return void 0;
        }
        let lines = stdout.trim().split(/\r?\n/);
        for (let line of lines) {
          try {
            let yarn = JSON.parse(line);
            if (yarn.type === "log") {
              return path6.join(yarn.data, "node_modules");
            }
          } catch (e) {
          }
        }
        return void 0;
      } catch (err) {
        return void 0;
      } finally {
        process.removeListener("SIGPIPE", handler);
      }
    }
    exports.resolveGlobalYarnPath = resolveGlobalYarnPath;
    var FileSystem;
    (function(FileSystem2) {
      let _isCaseSensitive = void 0;
      function isCaseSensitive() {
        if (_isCaseSensitive !== void 0) {
          return _isCaseSensitive;
        }
        if (process.platform === "win32") {
          _isCaseSensitive = false;
        } else {
          _isCaseSensitive = !fs4.existsSync(__filename.toUpperCase()) || !fs4.existsSync(__filename.toLowerCase());
        }
        return _isCaseSensitive;
      }
      FileSystem2.isCaseSensitive = isCaseSensitive;
      function isParent(parent, child) {
        if (isCaseSensitive()) {
          return path6.normalize(child).indexOf(path6.normalize(parent)) === 0;
        } else {
          return path6.normalize(child).toLowerCase().indexOf(path6.normalize(parent).toLowerCase()) === 0;
        }
      }
      FileSystem2.isParent = isParent;
    })(FileSystem || (exports.FileSystem = FileSystem = {}));
    function resolveModulePath(workspaceRoot, moduleName, nodePath, tracer) {
      if (nodePath) {
        if (!path6.isAbsolute(nodePath)) {
          nodePath = path6.join(workspaceRoot, nodePath);
        }
        return resolve(moduleName, nodePath, nodePath, tracer).then((value) => {
          if (FileSystem.isParent(nodePath, value)) {
            return value;
          } else {
            return Promise.reject(new Error(`Failed to load ${moduleName} from node path location.`));
          }
        }).then(void 0, (_error) => {
          return resolve(moduleName, resolveGlobalNodePath(tracer), workspaceRoot, tracer);
        });
      } else {
        return resolve(moduleName, resolveGlobalNodePath(tracer), workspaceRoot, tracer);
      }
    }
    exports.resolveModulePath = resolveModulePath;
  }
});

// node_modules/vscode-languageserver-protocol/node.js
var require_node2 = __commonJS({
  "node_modules/vscode-languageserver-protocol/node.js"(exports, module) {
    "use strict";
    module.exports = require_main3();
  }
});

// node_modules/vscode-languageserver/lib/common/inlineCompletion.proposed.js
var require_inlineCompletion_proposed = __commonJS({
  "node_modules/vscode-languageserver/lib/common/inlineCompletion.proposed.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineCompletionFeature = void 0;
    var vscode_languageserver_protocol_1 = require_main3();
    var InlineCompletionFeature = (Base) => {
      return class extends Base {
        get inlineCompletion() {
          return {
            on: (handler) => {
              return this.connection.onRequest(vscode_languageserver_protocol_1.InlineCompletionRequest.type, (params, cancel) => {
                return handler(params, cancel, this.attachWorkDoneProgress(params));
              });
            }
          };
        }
      };
    };
    exports.InlineCompletionFeature = InlineCompletionFeature;
  }
});

// node_modules/vscode-languageserver/lib/common/api.js
var require_api3 = __commonJS({
  "node_modules/vscode-languageserver/lib/common/api.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProposedFeatures = exports.NotebookDocuments = exports.TextDocuments = exports.SemanticTokensBuilder = void 0;
    var semanticTokens_1 = require_semanticTokens();
    Object.defineProperty(exports, "SemanticTokensBuilder", { enumerable: true, get: function() {
      return semanticTokens_1.SemanticTokensBuilder;
    } });
    var ic = require_inlineCompletion_proposed();
    __exportStar(require_main3(), exports);
    var textDocuments_1 = require_textDocuments();
    Object.defineProperty(exports, "TextDocuments", { enumerable: true, get: function() {
      return textDocuments_1.TextDocuments;
    } });
    var notebook_1 = require_notebook();
    Object.defineProperty(exports, "NotebookDocuments", { enumerable: true, get: function() {
      return notebook_1.NotebookDocuments;
    } });
    __exportStar(require_server(), exports);
    var ProposedFeatures2;
    (function(ProposedFeatures3) {
      ProposedFeatures3.all = {
        __brand: "features",
        languages: ic.InlineCompletionFeature
      };
    })(ProposedFeatures2 || (exports.ProposedFeatures = ProposedFeatures2 = {}));
  }
});

// node_modules/vscode-languageserver/lib/node/main.js
var require_main4 = __commonJS({
  "node_modules/vscode-languageserver/lib/node/main.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createConnection = exports.Files = void 0;
    var node_util_1 = __require("node:util");
    var Is = require_is();
    var server_1 = require_server();
    var fm = require_files();
    var node_1 = require_node2();
    __exportStar(require_node2(), exports);
    __exportStar(require_api3(), exports);
    var Files;
    (function(Files2) {
      Files2.uriToFilePath = fm.uriToFilePath;
      Files2.resolveGlobalNodePath = fm.resolveGlobalNodePath;
      Files2.resolveGlobalYarnPath = fm.resolveGlobalYarnPath;
      Files2.resolve = fm.resolve;
      Files2.resolveModulePath = fm.resolveModulePath;
    })(Files || (exports.Files = Files = {}));
    var _protocolConnection;
    function endProtocolConnection() {
      if (_protocolConnection === void 0) {
        return;
      }
      try {
        _protocolConnection.end();
      } catch (_err) {
      }
    }
    var _shutdownReceived = false;
    var exitTimer = void 0;
    function setupExitTimer() {
      const argName = "--clientProcessId";
      function runTimer(value) {
        try {
          let processId = parseInt(value);
          if (!isNaN(processId)) {
            exitTimer = setInterval(() => {
              try {
                process.kill(processId, 0);
              } catch (ex) {
                endProtocolConnection();
                process.exit(_shutdownReceived ? 0 : 1);
              }
            }, 3e3);
          }
        } catch (e) {
        }
      }
      for (let i = 2; i < process.argv.length; i++) {
        let arg = process.argv[i];
        if (arg === argName && i + 1 < process.argv.length) {
          runTimer(process.argv[i + 1]);
          return;
        } else {
          let args = arg.split("=");
          if (args[0] === argName) {
            runTimer(args[1]);
          }
        }
      }
    }
    setupExitTimer();
    var watchDog = {
      initialize: (params) => {
        const processId = params.processId;
        if (Is.number(processId) && exitTimer === void 0) {
          setInterval(() => {
            try {
              process.kill(processId, 0);
            } catch (ex) {
              process.exit(_shutdownReceived ? 0 : 1);
            }
          }, 3e3);
        }
      },
      get shutdownReceived() {
        return _shutdownReceived;
      },
      set shutdownReceived(value) {
        _shutdownReceived = value;
      },
      exit: (code) => {
        endProtocolConnection();
        process.exit(code);
      }
    };
    function createConnection2(arg1, arg2, arg3, arg4) {
      let factories;
      let input;
      let output;
      let options;
      if (arg1 !== void 0 && arg1.__brand === "features") {
        factories = arg1;
        arg1 = arg2;
        arg2 = arg3;
        arg3 = arg4;
      }
      if (node_1.ConnectionStrategy.is(arg1) || node_1.ConnectionOptions.is(arg1)) {
        options = arg1;
      } else {
        input = arg1;
        output = arg2;
        options = arg3;
      }
      return _createConnection(input, output, options, factories);
    }
    exports.createConnection = createConnection2;
    function _createConnection(input, output, options, factories) {
      let stdio = false;
      if (!input && !output && process.argv.length > 2) {
        let port = void 0;
        let pipeName = void 0;
        let argv = process.argv.slice(2);
        for (let i = 0; i < argv.length; i++) {
          let arg = argv[i];
          if (arg === "--node-ipc") {
            input = new node_1.IPCMessageReader(process);
            output = new node_1.IPCMessageWriter(process);
            break;
          } else if (arg === "--stdio") {
            stdio = true;
            input = process.stdin;
            output = process.stdout;
            break;
          } else if (arg === "--socket") {
            port = parseInt(argv[i + 1]);
            break;
          } else if (arg === "--pipe") {
            pipeName = argv[i + 1];
            break;
          } else {
            var args = arg.split("=");
            if (args[0] === "--socket") {
              port = parseInt(args[1]);
              break;
            } else if (args[0] === "--pipe") {
              pipeName = args[1];
              break;
            }
          }
        }
        if (port) {
          let transport = (0, node_1.createServerSocketTransport)(port);
          input = transport[0];
          output = transport[1];
        } else if (pipeName) {
          let transport = (0, node_1.createServerPipeTransport)(pipeName);
          input = transport[0];
          output = transport[1];
        }
      }
      var commandLineMessage = "Use arguments of createConnection or set command line parameters: '--node-ipc', '--stdio' or '--socket={number}'";
      if (!input) {
        throw new Error("Connection input stream is not set. " + commandLineMessage);
      }
      if (!output) {
        throw new Error("Connection output stream is not set. " + commandLineMessage);
      }
      if (Is.func(input.read) && Is.func(input.on)) {
        let inputStream = input;
        inputStream.on("end", () => {
          endProtocolConnection();
          process.exit(_shutdownReceived ? 0 : 1);
        });
        inputStream.on("close", () => {
          endProtocolConnection();
          process.exit(_shutdownReceived ? 0 : 1);
        });
      }
      const connectionFactory = (logger) => {
        const result = (0, node_1.createProtocolConnection)(input, output, logger, options);
        if (stdio) {
          patchConsole(logger);
        }
        return result;
      };
      return (0, server_1.createConnection)(connectionFactory, watchDog, factories);
    }
    function patchConsole(logger) {
      function serialize(args) {
        return args.map((arg) => typeof arg === "string" ? arg : (0, node_util_1.inspect)(arg)).join(" ");
      }
      const counters = /* @__PURE__ */ new Map();
      console.assert = function assert(assertion, ...args) {
        if (assertion) {
          return;
        }
        if (args.length === 0) {
          logger.error("Assertion failed");
        } else {
          const [message, ...rest] = args;
          logger.error(`Assertion failed: ${message} ${serialize(rest)}`);
        }
      };
      console.count = function count(label = "default") {
        const message = String(label);
        let counter = counters.get(message) ?? 0;
        counter += 1;
        counters.set(message, counter);
        logger.log(`${message}: ${message}`);
      };
      console.countReset = function countReset(label) {
        if (label === void 0) {
          counters.clear();
        } else {
          counters.delete(String(label));
        }
      };
      console.debug = function debug8(...args) {
        logger.log(serialize(args));
      };
      console.dir = function dir(arg, options) {
        logger.log((0, node_util_1.inspect)(arg, options));
      };
      console.log = function log(...args) {
        logger.log(serialize(args));
      };
      console.error = function error(...args) {
        logger.error(serialize(args));
      };
      console.trace = function trace(...args) {
        const stack = new Error().stack.replace(/(.+\n){2}/, "");
        let message = "Trace";
        if (args.length !== 0) {
          message += `: ${serialize(args)}`;
        }
        logger.log(`${message}
${stack}`);
      };
      console.warn = function warn(...args) {
        logger.warn(serialize(args));
      };
    }
  }
});

// node_modules/vscode-languageserver/node.js
var require_node3 = __commonJS({
  "node_modules/vscode-languageserver/node.js"(exports, module) {
    "use strict";
    module.exports = require_main4();
  }
});

// language-server/src/server.ts
var import_node = __toESM(require_node3(), 1);

// node_modules/vscode-languageserver-textdocument/lib/esm/main.js
var FullTextDocument = class _FullTextDocument {
  constructor(uri, languageId, version, content) {
    this._uri = uri;
    this._languageId = languageId;
    this._version = version;
    this._content = content;
    this._lineOffsets = void 0;
  }
  get uri() {
    return this._uri;
  }
  get languageId() {
    return this._languageId;
  }
  get version() {
    return this._version;
  }
  getText(range) {
    if (range) {
      const start = this.offsetAt(range.start);
      const end = this.offsetAt(range.end);
      return this._content.substring(start, end);
    }
    return this._content;
  }
  update(changes, version) {
    for (const change of changes) {
      if (_FullTextDocument.isIncremental(change)) {
        const range = getWellformedRange(change.range);
        const startOffset = this.offsetAt(range.start);
        const endOffset = this.offsetAt(range.end);
        this._content = this._content.substring(0, startOffset) + change.text + this._content.substring(endOffset, this._content.length);
        const startLine = Math.max(range.start.line, 0);
        const endLine = Math.max(range.end.line, 0);
        let lineOffsets = this._lineOffsets;
        const addedLineOffsets = computeLineOffsets(change.text, false, startOffset);
        if (endLine - startLine === addedLineOffsets.length) {
          for (let i = 0, len = addedLineOffsets.length; i < len; i++) {
            lineOffsets[i + startLine + 1] = addedLineOffsets[i];
          }
        } else {
          if (addedLineOffsets.length < 1e4) {
            lineOffsets.splice(startLine + 1, endLine - startLine, ...addedLineOffsets);
          } else {
            this._lineOffsets = lineOffsets = lineOffsets.slice(0, startLine + 1).concat(addedLineOffsets, lineOffsets.slice(endLine + 1));
          }
        }
        const diff = change.text.length - (endOffset - startOffset);
        if (diff !== 0) {
          for (let i = startLine + 1 + addedLineOffsets.length, len = lineOffsets.length; i < len; i++) {
            lineOffsets[i] = lineOffsets[i] + diff;
          }
        }
      } else if (_FullTextDocument.isFull(change)) {
        this._content = change.text;
        this._lineOffsets = void 0;
      } else {
        throw new Error("Unknown change event received");
      }
    }
    this._version = version;
  }
  getLineOffsets() {
    if (this._lineOffsets === void 0) {
      this._lineOffsets = computeLineOffsets(this._content, true);
    }
    return this._lineOffsets;
  }
  positionAt(offset) {
    offset = Math.max(Math.min(offset, this._content.length), 0);
    const lineOffsets = this.getLineOffsets();
    let low = 0, high = lineOffsets.length;
    if (high === 0) {
      return { line: 0, character: offset };
    }
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] > offset) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    const line = low - 1;
    offset = this.ensureBeforeEOL(offset, lineOffsets[line]);
    return { line, character: offset - lineOffsets[line] };
  }
  offsetAt(position) {
    const lineOffsets = this.getLineOffsets();
    if (position.line >= lineOffsets.length) {
      return this._content.length;
    } else if (position.line < 0) {
      return 0;
    }
    const lineOffset = lineOffsets[position.line];
    if (position.character <= 0) {
      return lineOffset;
    }
    const nextLineOffset = position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
    const offset = Math.min(lineOffset + position.character, nextLineOffset);
    return this.ensureBeforeEOL(offset, lineOffset);
  }
  ensureBeforeEOL(offset, lineOffset) {
    while (offset > lineOffset && isEOL(this._content.charCodeAt(offset - 1))) {
      offset--;
    }
    return offset;
  }
  get lineCount() {
    return this.getLineOffsets().length;
  }
  static isIncremental(event) {
    const candidate = event;
    return candidate !== void 0 && candidate !== null && typeof candidate.text === "string" && candidate.range !== void 0 && (candidate.rangeLength === void 0 || typeof candidate.rangeLength === "number");
  }
  static isFull(event) {
    const candidate = event;
    return candidate !== void 0 && candidate !== null && typeof candidate.text === "string" && candidate.range === void 0 && candidate.rangeLength === void 0;
  }
};
var TextDocument;
(function(TextDocument2) {
  function create(uri, languageId, version, content) {
    return new FullTextDocument(uri, languageId, version, content);
  }
  TextDocument2.create = create;
  function update(document, changes, version) {
    if (document instanceof FullTextDocument) {
      document.update(changes, version);
      return document;
    } else {
      throw new Error("TextDocument.update: document must be created by TextDocument.create");
    }
  }
  TextDocument2.update = update;
  function applyEdits(document, edits) {
    const text = document.getText();
    const sortedEdits = mergeSort(edits.map(getWellformedEdit), (a, b) => {
      const diff = a.range.start.line - b.range.start.line;
      if (diff === 0) {
        return a.range.start.character - b.range.start.character;
      }
      return diff;
    });
    let lastModifiedOffset = 0;
    const spans = [];
    for (const e of sortedEdits) {
      const startOffset = document.offsetAt(e.range.start);
      if (startOffset < lastModifiedOffset) {
        throw new Error("Overlapping edit");
      } else if (startOffset > lastModifiedOffset) {
        spans.push(text.substring(lastModifiedOffset, startOffset));
      }
      if (e.newText.length) {
        spans.push(e.newText);
      }
      lastModifiedOffset = document.offsetAt(e.range.end);
    }
    spans.push(text.substr(lastModifiedOffset));
    return spans.join("");
  }
  TextDocument2.applyEdits = applyEdits;
})(TextDocument || (TextDocument = {}));
function mergeSort(data, compare) {
  if (data.length <= 1) {
    return data;
  }
  const p = data.length / 2 | 0;
  const left = data.slice(0, p);
  const right = data.slice(p);
  mergeSort(left, compare);
  mergeSort(right, compare);
  let leftIdx = 0;
  let rightIdx = 0;
  let i = 0;
  while (leftIdx < left.length && rightIdx < right.length) {
    const ret = compare(left[leftIdx], right[rightIdx]);
    if (ret <= 0) {
      data[i++] = left[leftIdx++];
    } else {
      data[i++] = right[rightIdx++];
    }
  }
  while (leftIdx < left.length) {
    data[i++] = left[leftIdx++];
  }
  while (rightIdx < right.length) {
    data[i++] = right[rightIdx++];
  }
  return data;
}
function computeLineOffsets(text, isAtLineStart, textOffset = 0) {
  const result = isAtLineStart ? [textOffset] : [];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (isEOL(ch)) {
      if (ch === 13 && i + 1 < text.length && text.charCodeAt(i + 1) === 10) {
        i++;
      }
      result.push(textOffset + i + 1);
    }
  }
  return result;
}
function isEOL(char) {
  return char === 13 || char === 10;
}
function getWellformedRange(range) {
  const start = range.start;
  const end = range.end;
  if (start.line > end.line || start.line === end.line && start.character > end.character) {
    return { start: end, end: start };
  }
  return range;
}
function getWellformedEdit(textEdit) {
  const range = getWellformedRange(textEdit.range);
  if (range !== textEdit.range) {
    return { newText: textEdit.newText, range };
  }
  return textEdit;
}

// language-server/src/server.ts
import fs3 from "node:fs";
import path5 from "node:path";

// src/lsp/instruction-catalog.ts
function implied(mnemonic, summary, opcode) {
  return { mnemonic, summary, modes: [{ mode: "implied", syntax: "", opcode, size: 1 }] };
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
  instruction("BRK", "Software break / interrupt.", [{ mode: "stack", syntax: "", opcode: 0, size: 2 }]),
  branch("BRL", "Branch always long (16-bit relative).", 130, 3),
  branch("BVC", "Branch if overflow clear.", 80),
  branch("BVS", "Branch if overflow set.", 112),
  implied("CLC", "Clear carry flag.", 24),
  implied("CLD", "Clear decimal flag.", 216),
  implied("CLI", "Clear interrupt-disable flag.", 88),
  implied("CLV", "Clear overflow flag.", 184),
  instruction("CMP", "Compare with the accumulator.", aluModes),
  instruction("COP", "Coprocessor enable interrupt.", [{ mode: "stack", syntax: "#const", opcode: 2, size: 2 }]),
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
  instruction("JSL", "Jump to subroutine long.", [{ mode: "absoluteLong", syntax: "long", opcode: 34, size: 4 }]),
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
  instruction("MVN", "Block move next (ascending).", [{ mode: "blockMove", syntax: "destBank,srcBank", opcode: 84, size: 3 }]),
  instruction("MVP", "Block move previous (descending).", [{ mode: "blockMove", syntax: "destBank,srcBank", opcode: 68, size: 3 }]),
  implied("NOP", "No operation.", 234),
  instruction("ORA", "Bitwise OR with the accumulator.", aluModes),
  instruction("PEA", "Push effective absolute address.", [{ mode: "stack", syntax: "addr", opcode: 244, size: 3 }]),
  instruction("PEI", "Push effective indirect address.", [{ mode: "stack", syntax: "(dp)", opcode: 212, size: 2 }]),
  instruction("PER", "Push effective PC-relative address.", [{ mode: "stack", syntax: "label", opcode: 98, size: 3 }]),
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
  instruction("REP", "Reset status bits.", [{ mode: "immediate", syntax: "#const", opcode: 194, size: 2 }]),
  instruction("ROL", "Rotate left through carry.", shiftModes),
  instruction("ROR", "Rotate right through carry.", shiftModes),
  implied("RTI", "Return from interrupt.", 64),
  implied("RTL", "Return from subroutine long.", 107),
  implied("RTS", "Return from subroutine.", 96),
  instruction("SBC", "Subtract with borrow from the accumulator.", aluModes),
  implied("SEC", "Set carry flag.", 56),
  implied("SED", "Set decimal flag.", 248),
  implied("SEI", "Set interrupt-disable flag.", 120),
  instruction("SEP", "Set status bits.", [{ mode: "immediate", syntax: "#const", opcode: 226, size: 2 }]),
  instruction("STA", "Store the accumulator.", aluModes.filter((mode) => mode.mode !== "immediate")),
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
  instruction("WDM", "Reserved (William D. Mensch) opcode.", [{ mode: "immediate", syntax: "#const", opcode: 66, size: 2 }]),
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
  instruction("INC", "Increment.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  instruction("DEC", "Decrement.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  instruction("ASL", "Arithmetic shift left.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  instruction("LSR", "Logical shift right.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  instruction("ROL", "Rotate left.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  instruction("ROR", "Rotate right.", [{ mode: "register", syntax: "A" }, { mode: "direct", syntax: "dp" }]),
  branch("BRA", "Branch always.", 47),
  branch("BEQ", "Branch if equal.", 240),
  branch("BNE", "Branch if not equal.", 208),
  branch("BCS", "Branch if carry set.", 176),
  branch("BCC", "Branch if carry clear.", 144),
  branch("BVS", "Branch if overflow set.", 112),
  branch("BVC", "Branch if overflow clear.", 80),
  branch("BMI", "Branch if minus.", 48),
  branch("BPL", "Branch if plus.", 16),
  instruction("CBNE", "Compare and branch if not equal.", [{ mode: "directRelative", syntax: "dp,label" }]),
  instruction("DBNZ", "Decrement and branch if not zero.", [{ mode: "directRelative", syntax: "dp,label" }]),
  instruction("JMP", "Jump.", [{ mode: "absolute", syntax: "!addr" }, { mode: "absoluteIndexedXIndirect", syntax: "[!addr+X]" }]),
  instruction("CALL", "Call subroutine.", [{ mode: "absolute", syntax: "!addr", opcode: 63, size: 3 }]),
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
var superFxCatalog = [
  implied("STOP", "Stop the GSU.", 0),
  implied("NOP", "No operation.", 1),
  implied("CACHE", "Set the cache base register.", 2),
  instruction("LSR", "Logical shift right.", [{ mode: "implied", syntax: "" }]),
  instruction("ROL", "Rotate left.", [{ mode: "implied", syntax: "" }]),
  instruction("ROR", "Rotate right.", [{ mode: "implied", syntax: "" }]),
  instruction("BRA", "Branch always.", [{ mode: "relative", syntax: "label" }]),
  instruction("BEQ", "Branch if equal.", [{ mode: "relative", syntax: "label" }]),
  instruction("BNE", "Branch if not equal.", [{ mode: "relative", syntax: "label" }]),
  instruction("TO", "Set the destination register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("FROM", "Set the source register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("WITH", "Set source and destination register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("ADD", "Add to the accumulator register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("SUB", "Subtract from the accumulator register.", [{ mode: "register", syntax: "Rn" }]),
  instruction("AND", "Bitwise AND.", [{ mode: "register", syntax: "Rn" }]),
  instruction("OR", "Bitwise OR.", [{ mode: "register", syntax: "Rn" }]),
  instruction("MULT", "Signed multiply.", [{ mode: "register", syntax: "Rn" }]),
  instruction("RPIX", "Read pixel.", [{ mode: "implied", syntax: "" }]),
  instruction("DIV2", "Divide by two.", [{ mode: "implied", syntax: "" }])
];
function getCatalogForArchitecture(architecture) {
  switch (architecture.toLowerCase()) {
    case "spc700":
    case "spc700-raw":
    case "spc700-inline":
      return spc700Catalog;
    case "superfx":
      return superFxCatalog;
    case "65816":
    default:
      return cpu65816Catalog;
  }
}

// src/Arch65816.ts
var debug = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug = d("Arch65816");
} catch {
}
var Arch65816 = class {
  assembler;
  constructor(assembler) {
    this.assembler = assembler;
  }
  /**
   * Returns the static 65816 instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog() {
    return cpu65816Catalog;
  }
  encode(words) {
    return this.asblock_65816(words);
  }
  estimateInstruction(instruction2) {
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand.expanded,
      instruction2.loweredOperand.length
    );
  }
  encodeInstruction(instruction2) {
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand.expanded,
      instruction2.loweredOperand.length
    );
  }
  lowerInstructionFromCommand(command) {
    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? [operandText] : []);
    const loweredOperands = operands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operandText);
    return {
      kind: "instruction",
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
  estimateSize(words) {
    if (words.length === 0) {
      return 0;
    }
    const mnemonic = words[0] ?? "";
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    return this.estimateResolvedInstruction(mnemonic, rawOperand, loweredOperand.expanded, loweredOperand.length);
  }
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
    const branchOpcodes2 = /* @__PURE__ */ new Set(["BPL", "BMI", "BVC", "BVS", "BCC", "BCS", "BNE", "BEQ", "BRA", "BRL"]);
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
    if (opcode.includes(".")) {
      const len = this.getlenfromchar(opcode[opcode.indexOf(".") + 1]);
      opcode = opcode.substring(0, opcode.indexOf("."));
      return 1 + len;
    }
    if (accumulatorRepeatOpcodes.has(opcode) && !rawOperand.trim()) {
      return 1;
    }
    if (accumulatorRepeatOpcodes.has(opcode) && rawOperand.startsWith("#")) {
      return this.assembler.operandResolver.getnum(rawOperand.substring(1));
    }
    if (branchOpcodes2.has(opcode)) {
      return opcode === "BRL" ? 3 : 2;
    }
    if (opcode === "MVP" || opcode === "MVN") {
      return 3;
    }
    if (opcode === "PER") {
      return 3;
    }
    if (opcode === "JSL" || opcode === "JML") {
      return 4;
    }
    if (opcode === "JMP" || opcode === "JSR") {
      return 3;
    }
    if (opcode === "PEA") {
      return 3;
    }
    if (["BRK", "COP", "PEI", "REP", "SEP", "WDM"].includes(opcode)) {
      return 2;
    }
    if (operand.startsWith("#")) {
      return 1 + operandLength;
    }
    if (/^\$[\da-f]{6}(,x)?$/i.test(operand)) {
      return 4;
    }
    return 1 + operandLength;
  }
  /**
   * Processes a 65816 assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_65816(words) {
    debug("asblock_65816", words);
    if (words.length === 0) {
      return false;
    }
    const mnemonic = words[0] ?? "";
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    return this.encodeResolvedInstruction(mnemonic, rawOperand, loweredOperand.expanded, loweredOperand.length);
  }
  encodeResolvedInstruction(mnemonic, rawOperand, operand, operandLength) {
    let opcode = mnemonic.toUpperCase();
    debug("asblock_65816 operand expanded", operand, "expected length:", operandLength);
    let len = 0;
    let explicitlen = false;
    if (opcode.includes(".")) {
      len = this.getlenfromchar(opcode[opcode.indexOf(".") + 1]);
      explicitlen = true;
      opcode = opcode.substring(0, opcode.indexOf("."));
    } else {
      len = operandLength;
    }
    debug("asblock_65816 opcode", opcode);
    debug("asblock_65816 operand", operand);
    if (["ASL", "LSR", "ROL", "ROR", "INC", "DEC"].includes(opcode)) {
      return this.handleArithmeticOperations(opcode, operand, len, explicitlen);
    }
    if (["SBC", "STA", "LDA", "ADC"].includes(opcode)) {
      return this.handleMemoryOperations(opcode, operand, len, explicitlen, rawOperand);
    }
    if (["AND", "EOR", "ORA", "CMP", "CPX", "CPY"].includes(opcode)) {
      return this.handleLogicAndCompareOperations(opcode, operand, len, explicitlen);
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
   * Handles ORA, SBC, STA, LDA, EOR, CMP, AND, ADC with all valid addressing modes.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @param {string} rawOperand The raw source operand before expansion.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleMemoryOperations(opcode, operand, len, explicitlen, rawOperand = operand) {
    debug("handleMemoryOperations", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const resolvedOperand = loweredOperand.expanded;
    const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
    const isExplicitDirectPage = loweredOperand.explicitDirectPage ?? false;
    const isExplicitDirectPageIndexedX = loweredOperand.explicitDirectPageIndexedX ?? false;
    if (loweredOperand.immediate) {
      debug("handleMemoryOperations Immediate Mode (#$XX)", opcode, resolvedOperand);
      const immediateOpcodes = {
        ADC: 105,
        LDA: 169,
        SBC: 233
        // STA does not support immediate mode
      };
      if (opcode in immediateOpcodes) {
        this.assembler.write1(immediateOpcodes[opcode]);
        if (len === 1) {
          this.assembler.write1(this.assembler.operandResolver.getnum(resolvedOperand));
        } else {
          this.assembler.write2(this.assembler.operandResolver.getnum(resolvedOperand));
        }
        return true;
      }
      throw new Error(`Error: ${opcode} does not support immediate mode.`);
    }
    if (explicitlen) {
      if (loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
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
      } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect) {
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
      debug("handleMemoryOperations Absolute Indexed,X", opcode, resolvedOperand);
      const absoluteIndexedXOpcodes = {
        ADC: 125,
        STA: 157,
        LDA: 189,
        SBC: 253
      };
      if (opcode in absoluteIndexedXOpcodes) {
        debug("handleMemoryOperations =", absoluteIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(absoluteIndexedXOpcodes[opcode]);
        debug("handleMemoryOperations =", this.assembler.operandResolver.getnum(baseOperand).toString(16));
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }
    if (loweredOperand.mode === "absoluteLongIndexedX") {
      debug("handleMemoryOperations Absolute Long Indexed,X", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Indexed Indirect (X)", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Direct Page Indirect", opcode, resolvedOperand);
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
    if ((this.assembler.optimizeDirectPage || isExplicitDirectPageIndexedX) && loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
      debug("handleMemoryOperations DP Indexed,X", opcode, resolvedOperand);
      const dpIndexedXOpcodes = {
        ADC: 117,
        STA: 149,
        LDA: 181,
        SBC: 245
      };
      if (opcode in dpIndexedXOpcodes) {
        debug("handleMemoryOperations = 1", dpIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(dpIndexedXOpcodes[opcode]);
        debug("handleMemoryOperations = 1.5", baseOperand);
        const dpAddress = this.assembler.operandResolver.getnum(baseOperand);
        debug("handleMemoryOperations = 2", dpAddress.toString(16));
        this.assembler.write1(dpAddress);
        return true;
      }
    }
    if (loweredOperand.mode === "stackRelative") {
      debug("handleMemoryOperations Indexed Indirect (sr,S)", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Stack Relative Indexed Indirect (sr,S),Y", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Indirect Indexed (Y)", opcode, resolvedOperand);
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
    if (loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
      debug("handleMemoryOperations Absolute Indexed (X)", opcode, resolvedOperand);
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
    if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect) {
      debug("handleMemoryOperations Absolute Indexed (Y)", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Absolute Long ($000000)", opcode, resolvedOperand);
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
      debug("handleMemoryOperations Absolute", opcode, resolvedOperand);
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
    if (this.assembler.optimizeDirectPage || isExplicitDirectPage) {
      debug("handleMemoryOperations Direct Page", opcode, operand);
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
      debug("handleMemoryOperations Direct Page optimization disabled; using absolute", opcode, operand);
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
   * Handles AND, EOR, ORA, CMP, CPX, and CPY instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleLogicAndCompareOperations(opcode, operand, len, explicitlen) {
    debug("handleLogicAndCompareOperations", { opcode, operand, len, explicitlen });
    const opcodes = {
      ORA: { immediate: 9, direct: 5, directX: 21, absolute: 13, absoluteX: 29, absoluteY: 25, indirectX: 1, indirectY: 17, indirect: 18, indirectLong: 15, indirectLongY: 31, stackRelative: 3, stackRelativeIndirectY: 19, absoluteLong: 15, absoluteLongX: 31, directIndirectLong: 7, directIndirectLongY: 23 },
      AND: { immediate: 41, direct: 37, directX: 53, absolute: 45, absoluteX: 61, absoluteY: 57, indirectX: 33, indirectY: 49, indirect: 50, indirectLong: 47, indirectLongY: 63, stackRelative: 35, stackRelativeIndirectY: 51, absoluteLong: 47, absoluteLongX: 63, directIndirectLong: 39, directIndirectLongY: 55 },
      EOR: { immediate: 73, direct: 69, directX: 85, absolute: 77, absoluteX: 93, absoluteY: 89, indirectX: 65, indirectY: 81, indirect: 82, indirectLong: 79, indirectLongY: 95, stackRelative: 67, stackRelativeIndirectY: 83, absoluteLong: 79, absoluteLongX: 95, directIndirectLong: 71, directIndirectLongY: 87 },
      CMP: { immediate: 201, direct: 197, directX: 213, absolute: 205, absoluteX: 221, absoluteY: 217, indirectX: 193, indirectY: 209, indirect: 210, indirectLong: 207, indirectLongY: 223, stackRelative: 195, stackRelativeIndirectY: 211, absoluteLong: 207, absoluteLongX: 223, directIndirectLong: 199, directIndirectLongY: 215 },
      CPX: { immediate: 224, direct: 228, absolute: 236 },
      CPY: { immediate: 192, direct: 196, absolute: 204 }
    };
    const dpMap = { AND: 37, ORA: 5, EOR: 69, CMP: 197, CPX: 228, CPY: 196 };
    const absMap = { AND: 45, ORA: 13, EOR: 77, CMP: 205, CPX: 236, CPY: 204 };
    const absLongMap = { AND: 47, ORA: 15, EOR: 79, CMP: 207 };
    const dpXMap = { AND: 53, ORA: 21, EOR: 85, CMP: 213 };
    const absXMap = { AND: 61, ORA: 29, EOR: 93, CMP: 221 };
    const absYMap = { AND: 57, ORA: 25, EOR: 89, CMP: 217 };
    if (!(opcode in opcodes)) {
      return false;
    }
    const logicOpcode = opcode;
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const resolvedOperand = loweredOperand.expanded;
    const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
    let address = 0;
    let mode;
    if (loweredOperand.immediate) {
      debug("handleLogicAndCompareOperations Immediate Mode", opcode, resolvedOperand);
      mode = "immediate";
      address = this.assembler.operandResolver.getnum(baseOperand);
      this.assembler.write1(opcodes[logicOpcode].immediate);
      if (len === 1) {
        this.assembler.write1(address);
      } else {
        this.assembler.write2(address);
      }
      return true;
    }
    if (explicitlen) {
      const forcedIndexedMode = !loweredOperand.indirect ? loweredOperand.indexRegister === "x" ? "x" : loweredOperand.mode === "absoluteIndexedY" ? "y" : void 0 : void 0;
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
      this.assembler.operandResolver.getnum(resolvedOperand);
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
    debug("handleLogicAndCompareOperations mode", mode, operand);
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
   * Handles operators that do not take operands.
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
    debug("handleNoOperandOperations", { opcode, operand, value: stackOpcodes[opcode].toString(16) });
    let count = 1;
    if (operand && operand.startsWith("#")) {
      let repStr = operand.substring(1);
      if (repStr.startsWith("$")) {
        repStr = repStr.substring(1);
        debug("handleNoOperandOperations removed $ prefix", repStr);
      }
      count = Number.parseInt(repStr, 10);
      debug("handleNoOperandOperations count", count);
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
   * Handles ASL (Arithmetic Shift Left), LSR (Logical Shift Right),
   * ROL (Rotate Left), ROR (Rotate Right), INC (Increment), and DEC (Decrement).
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleArithmeticOperations(opcode, operand, len, explicitlen) {
    debug("handleArithmeticOperations", opcode, operand);
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
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operandText);
    const rawOperand = operandText;
    const isIndexed = loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
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
      debug("handleArithmeticOperations DP Indexed,X", opcode, rawOperand);
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
   * Handles Load X/Y Register instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleLoadRegister(opcode, operand, len, explicitlen) {
    debug("handleLoadRegister", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
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
      if (len === 1) {
        this.assembler.write1(address);
      } else {
        this.assembler.write2(address);
      }
      return true;
    }
    const isIndexed = isLDX && loweredOperand.indexRegister === "y" && !loweredOperand.indirect || isLDY && loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
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
   * Handles the JMP (Jump), JSR (Jump to Subroutine), and JSL (Jump to Subroutine Long) instructions.
   * @param {string} opcode - The opcode to handle.
   * @param {string} operand - The resolved operand to handle.
   * @param {string} rawOperand - The original source operand before expansion.
   * @returns {boolean} True if the opcode and operand were handled successfully, false otherwise.
   */
  handleJump(opcode, operand, rawOperand = operand) {
    debug("handleJump", { opcode, operand, rawOperand });
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
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
      ({ mode, address } = selectDirectJumpMode(opcode, this.assembler.operandResolver.getnum(operand)));
      debug("handleJump mode", mode);
    } else if (/^\$[\dA-Fa-f]{1,6}$/.test(operand)) {
      ({ mode, address } = selectDirectJumpMode(opcode, this.assembler.operandResolver.getnum(operand)));
      debug("handleJump mode", mode);
    } else if (loweredOperand.mode === "indirectLong") {
      mode = "JMP_INDIRECT_LONG";
      debug("handleJump mode", mode);
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
    } else if (opcode === "JSR" && loweredOperand.mode === "indexedIndirectX") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JSR_INDEXED_INDIRECT";
      debug("handleJump mode", mode);
    } else if (loweredOperand.mode === "indexedIndirectX") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDEXED_INDIRECT";
      debug("handleJump mode", mode);
    } else if (loweredOperand.mode === "directPageIndirect") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDIRECT";
      debug("handleJump mode", mode);
    } else {
      try {
        ({ mode, address } = selectDirectJumpMode(opcode, this.assembler.operandResolver.getnum(baseOperand)));
        debug("handleJump mode", mode);
      } catch {
        debug("handleJump", `Error: Invalid operand format for ${opcode}: ${operand}`);
        throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
      }
    }
    debug("handleJump address", address?.toString(16));
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
   * Handles the PER (Push Effective Relative Address) instruction.
   * @param {string} operand The operand to handle.
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handlePER(operand) {
    debug("handlePER", operand);
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
   * Handles STX, STY, and STZ instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the instruction was handled, false otherwise
   */
  handleStoreOperations(opcode, operand, len, explicitlen) {
    debug("handleStoreOperations", { opcode, operand, len, explicitlen });
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
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
    const getForcedOpcode = (map, fallback) => {
      const forced = map[len];
      return forced ?? fallback;
    };
    let address = 0;
    let mode;
    const isIndexed = storeOpcode === "STX" && loweredOperand.indexRegister === "y" && !loweredOperand.indirect || storeOpcode === "STY" && loweredOperand.indexRegister === "x" && !loweredOperand.indirect || storeOpcode === "STZ" && loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
    if (isIndexed) {
      operand = rawOperand.slice(0, -2).trim();
    }
    if (explicitlen) {
      if (isIndexed) {
        if (storeOpcode === "STZ") {
          const forcedSTZIndexed = { 1: 116, 2: 158 };
          this.assembler.write1(getForcedOpcode(forcedSTZIndexed, 158));
        } else {
          if (storeOpcode === "STX") {
            const forcedSTX = { 1: 134, 2: 142 };
            this.assembler.write1(getForcedOpcode(forcedSTX, 142));
          } else if (storeOpcode === "STY") {
            const forcedSTY = { 1: 132, 2: 140 };
            this.assembler.write1(getForcedOpcode(forcedSTY, 140));
          }
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
    if (loweredOperand.mode === "directPageIndexedX" && storeOpcodes[storeOpcode].directX && /^\$[\da-f]{2}$/i.test(operand)) {
      mode = "directX";
      address = this.assembler.operandResolver.getnum(operand);
    } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect && storeOpcodes[storeOpcode].directY) {
      mode = "directY";
      address = this.assembler.operandResolver.getnum(operand);
    } else if (loweredOperand.mode === "absoluteIndexedX" && storeOpcodes[storeOpcode].absoluteX) {
      mode = "absoluteX";
      address = this.assembler.operandResolver.getnum(operand);
    }
    if (!isIndexed && /^\$[\dA-Fa-f]{4}$/.test(operand)) {
      mode = "absolute";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].absolute);
      this.assembler.write2(address);
      debug("handleStoreOperations mode", mode);
      return true;
    } else if (!isIndexed && /^\$[\dA-Fa-f]{2}$/.test(operand)) {
      mode = "direct";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].direct);
      this.assembler.write1(address);
      debug("handleStoreOperations mode", mode);
      return true;
    } else if (isIndexed) {
      if (storeOpcode === "STX") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directY";
          this.assembler.write1(storeOpcodes[storeOpcode].directY);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STY") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STZ") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{4}$/i.test(operand) && storeOpcodes[storeOpcode].absoluteX) {
          mode = "absoluteX";
          this.assembler.write1(storeOpcodes[storeOpcode].absoluteX);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug("handleStoreOperations mode", mode);
        return true;
      }
    }
    throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
  }
  /**
   * Handles MVN (Move Negative) and MVP (Move Positive) instructions.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBlockMove(opcode, operand) {
    debug("handleBlockMove", opcode, operand);
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
   * Handles BIT, TSB, and TRB instructions, including all their addressing modes.
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBitTestOperations(opcode, operand, len, explicitlen) {
    debug("handleBitTestOperations", { opcode, operand });
    opcode = opcode.toUpperCase();
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
    const rawOperand = operand;
    const normalizedOperand = loweredOperand.indexRegister === "x" && !loweredOperand.indirect ? rawOperand.slice(0, -2).trim() : rawOperand;
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
      debug("handleBitTestOperations immediate", { opcode, operand, value: forcedMaps[bitOpcode].immediate?.toString(16) });
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
      const isIndexed = loweredOperand.indexRegister === "x" && !loweredOperand.indirect;
      address = this.assembler.operandResolver.getnum(normalizedOperand);
      if (explicitlen) {
        if (isIndexed) {
          if (!forcedMaps[bitOpcode].directX) {
            throw new Error(`Opcode ${opcode} does not support indexed addressing in forced mode.`);
          }
          this.assembler.write1(getForcedBitOpcode(forcedMaps[bitOpcode].directX, forcedMaps[bitOpcode].directX[2] ?? forcedMaps[bitOpcode].directX[1] ?? 0));
          outLength = len === 1 ? 1 : 2;
        } else {
          this.assembler.write1(getForcedBitOpcode(forcedMaps[bitOpcode].direct, forcedMaps[bitOpcode].direct[2] ?? forcedMaps[bitOpcode].direct[1] ?? 0));
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
   * Handles generic opcodes with standard addressing.
   * @param {string} opcode The opcode to handle.
   * @param {number} num The operand value.
   * @param {number} len The length of the operand.
   * @param {boolean} explicitlen Whether the operand length is explicit.
   * @param {boolean} hexconstant Whether the operand is a hex constant.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleGenericOpcode(opcode, num, len, explicitlen, hexconstant) {
    debug("handleGenericOpcode", { opcode, num, len, explicitlen, hexconstant });
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
        debug(`arch65816 handleGenericOpcode: ${opcode} assuming 8-bit mode.`);
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
   * Handle Branch Instructions
   * @param {string} opcode The opcode to handle.
   * @param {string} operand The operand to handle.
   * @returns {boolean} True if the opcode was handled, false otherwise.
   */
  handleBranchInstructions(opcode, operand) {
    debug("handleBranchInstructions", opcode, operand);
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
    const instructionSize = opcode === "BRL" ? 3 : 2;
    const branchReferenceAddress = this.assembler.currentTargetAddress + instructionSize;
    if (/^\++$/.test(operand)) {
      targetAddress = this.assembler.symbolScope.findNextLabel(operand, branchReferenceAddress);
    } else if (/^-+$/.test(operand)) {
      targetAddress = this.assembler.symbolScope.findPreviousLabel(operand, branchReferenceAddress);
    } else {
      targetAddress = this.assembler.operandResolver.getnum(operand);
    }
    const currentAddress = this.assembler.currentTargetAddress + instructionSize;
    const relativeAddress = targetAddress - currentAddress;
    debug("handleBranchInstructions targetAddress:", targetAddress, "/", targetAddress.toString(16));
    debug("handleBranchInstructions currentAddress:", currentAddress, "/", currentAddress.toString(16));
    debug("handleBranchInstructions relativeAddress:", relativeAddress, "/", relativeAddress.toString(16));
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
      throw new Error("Error: relativeAddress is NaN.");
    }
    debug("handleBranchInstructions relativeAddress", relativeAddress, "/", relativeAddress.toString(16));
    if (opcode === "BRL") {
      if (relativeAddress < -32768 || relativeAddress > 32767) {
        throw new Error(`Error: BRL target out of range (${relativeAddress}).`);
      }
      this.assembler.write1(branchOpcodes2[opcode]);
      this.assembler.write2(relativeAddress);
      return true;
    } else {
      if (relativeAddress < -128 || relativeAddress > 127) {
        throw new Error(`Error: Branch target out of range (${relativeAddress}).`);
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
   * Handles bit manipulation instructions (TSB, TRB) with both absolute and direct page addressing modes.
   * @param {string} opcode (TSB or TRB)
   * @param {string} operand (absolute or direct)
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMemoryBitInstructions(opcode, operand) {
    debug("handleMemoryBitInstructions", opcode, operand);
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operand);
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
   * Resolves the operand length from opcode suffix.
   * @param {string} c The opcode suffix to resolve the length of.
   * @returns {number} The operand length.
   */
  getlenfromchar(c) {
    debug("getlenfromchar", c);
    switch (c.toLowerCase()) {
      case "b":
        return 1;
      case "w":
        return 2;
      case "l":
        return 3;
      case "d":
        debug("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }
};

// src/ArchSPC700.ts
var debug2 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug2 = d("ArchSPC700");
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
function isAccumulator(op, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "A") {
    return true;
  }
  return op.toUpperCase() === "A";
}
function isRegisterX(op, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op.toUpperCase() === "X";
}
function isRegisterY(op, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op.toUpperCase() === "Y";
}
function isParenX(op, lowered) {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op.trim().toUpperCase() === "(X)";
}
function isParenY(op, lowered) {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op.trim().toUpperCase() === "(Y)";
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
var bitBranchOpcodes = {
  BBC0: 19,
  BBC1: 51,
  BBC2: 83,
  BBC3: 115,
  BBC4: 147,
  BBC5: 179,
  BBC6: 211,
  BBC7: 243,
  BBS0: 3,
  BBS1: 35,
  BBS2: 67,
  BBS3: 99,
  BBS4: 131,
  BBS5: 163,
  BBS6: 195,
  BBS7: 227
};
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
var bit1Opcodes = {
  OR1: 10,
  AND1: 74,
  EOR1: 138
};
var ArchSPC700 = class {
  assembler;
  constructor(assembler) {
    this.assembler = assembler;
  }
  /**
   * Returns the static SPC700 instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog() {
    return spc700Catalog;
  }
  encode(words) {
    return this.asblock_spc700(words);
  }
  estimateInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  encodeInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operands,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  lowerInstructionFromCommand(command) {
    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? this.splitTopLevelComma(operandText) : []);
    const loweredOperands = operands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operandText);
    return {
      kind: "instruction",
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
  estimateSize(words) {
    if (words.length === 0) {
      return 0;
    }
    return this.estimateResolvedInstruction(words[0], words.slice(1).join(" "));
  }
  estimateResolvedInstruction(mnemonic, operandText, loweredOperand, loweredOperands = []) {
    let size = 1;
    const opcode = mnemonic.toUpperCase();
    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const expandedOperand = firstLowered?.expanded ?? operandText;
    if (expandedOperand) {
      if (expandedOperand.startsWith("#")) {
        size = 2;
      } else if (expandedOperand.includes("$") || loweredOperands.length > 1 || expandedOperand.includes(",")) {
        size = 3;
      }
    }
    if (["JSL", "JML"].includes(opcode)) {
      size = 4;
    }
    return size;
  }
  asblock_spc700(words) {
    debug2("asblock_spc700", words);
    if (words.length === 0) {
      return false;
    }
    const opcode = words[0];
    const rawOperand = words.slice(1).join(" ").trim();
    const parsedOperands = rawOperand ? this.splitTopLevelComma(rawOperand) : [];
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = parsedOperands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    return this.encodeResolvedInstruction(opcode, parsedOperands, loweredOperand, loweredOperands);
  }
  encodeResolvedInstruction(mnemonic, operands, loweredOperand, loweredOperands = []) {
    let opcode = mnemonic;
    const operand = loweredOperand?.expanded ?? "";
    const normalizedOperands = operands.map((operandText, index2) => loweredOperands[index2]?.expanded ?? operandText).filter((value) => value !== "");
    let forcedLen = null;
    let explicitlen = false;
    const dotIndex = opcode.indexOf(".");
    if (dotIndex !== -1) {
      forcedLen = this.getlenfromchar(opcode[dotIndex + 1]);
      explicitlen = true;
      opcode = opcode.substring(0, dotIndex);
    }
    opcode = opcode.toUpperCase().trim();
    debug2("asblock_spc700", { opcode, operand, forcedLen, explicitlen });
    if (this.handleSingleNoOperand(opcode)) {
      return true;
    }
    const firstLowered = loweredOperands[0];
    const secondLowered = loweredOperands[1];
    if (normalizedOperands.length === 1) {
      return this.handleOneOperand(opcode, normalizedOperands[0], forcedLen, explicitlen, firstLowered);
    } else if (normalizedOperands.length === 2) {
      return this.handleTwoOperands(opcode, normalizedOperands[0], normalizedOperands[1], forcedLen, explicitlen, firstLowered, secondLowered);
    }
    return false;
  }
  /**
   * Splits by commas at top-level, ignoring any parentheses grouping.
   * For spc700 code, we typically do not nest parentheses deeply, so a simpler approach may suffice.
   * @param {string} text - the operand string
   * @returns {string[]} array of operands
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
   * Handles single, no-operand opcodes, like NOP, BRK, etc.
   * @param {string} opcode - the opcode
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleSingleNoOperand(opcode) {
    debug2("handleSingleNoOperand", opcode);
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
   * Handle instructions that have exactly one operand
   * e.g. ASL A, LSR A, DEC A, DEC X, DEC Y,
   * or branches like BRA label, or bit set/clear with one operand, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} loweredOperand - optional lowered metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleOneOperand(opcode, operand, forcedLen, explicitlen, loweredOperand) {
    debug2("handleOneOperand", { opcode, operand, forcedLen, explicitlen });
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
   * Handle instructions that have exactly two operands, e.g. "ADC A,($12+X)" or "MOV $12,#$34".
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTwoOperands(opcode, left, right, forcedLen, explicitlen, leftLowered, rightLowered) {
    debug2("handleTwoOperands", { opcode, left, right, forcedLen, explicitlen });
    if (hasOwn(bitBranchOpcodes, opcode)) {
      if (this.handleTwoOperandsBitBranch(opcode, left, right)) {
        return true;
      }
    }
    if (opcode === "DBNZ" || opcode === "CBNE") {
      if (this.handleDbnzCbne(opcode, left, right, leftLowered, rightLowered)) {
        return true;
      }
    }
    if (this.handleCmpXyOrMovXy(opcode, [left, right].join(","), forcedLen, explicitlen, leftLowered, rightLowered)) {
      return true;
    }
    if (this.handleMemoryInstruction(opcode, left, right, forcedLen, explicitlen, leftLowered, rightLowered)) {
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
   * handleWordOpsTwoOperands: covers
   *   CMPW YA,$12  => 5A dp
   *   ADDW YA,$12  => 7A dp
   *   SUBW YA,$12  => 9A dp
   *   MOVW YA,$12  => BA dp
   *   MOVW $12,YA  => DA dp
   *
   * According to the test file lines:
   *   "CMPW YA,$12 => 5A 12"
   *   "ADDW YA,$12 => 7A 12"
   *   "SUBW YA,$12 => 9A 12"
   *   "MOVW YA,$12 => BA 12"
   *   "MOVW $12,YA => DA 12"
   *
   * The test only shows an 8-bit direct-page operand. No examples of $1234 for these instructions,
   * so we assume DP only.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleWordOpsTwoOperands(opcode, left, right) {
    debug2("handleWordOpsTwoOperands", { opcode, left, right });
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
   * Handle instructions like "ADC A,(X)" or "SBC (X),(Y)", "AND A,$1234", etc.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - the explicit length
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMemoryInstruction(opcode, left, right, forcedLen, explicitlen, leftLowered, rightLowered) {
    debug2("handleMemoryInstruction", { opcode, left, right });
    const opName = opcode.toUpperCase();
    if (!hasOwn(memOpTables, opName)) {
      debug2("handleMemoryInstruction not in table", { opcode, left, right });
      return false;
    }
    const table = memOpTables[opName];
    if (isAccumulator(left, leftLowered)) {
      debug2("handleMemoryInstruction left is A", { opcode, left, right });
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
   * Writes dp or abs address (1 or 2 bytes) depending on getAddressSize
   * @param {number} value - the value to write
   */
  writeDpOrAbs(value) {
    debug2("writeDpOrAbs", value);
    if (value <= 255) {
      this.assembler.write1(value & 255);
    } else {
      this.assembler.write1(value & 255);
      this.assembler.write1(value >> 8 & 255);
    }
  }
  /**
   * Classify operand for "A,(X)" style memory instructions,
   * returning an address mode name that matches e.g. a_indirectX, a_dp, a_abs, etc.
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {{ mode: string; val: number }} the address mode and value
   */
  classifySpc700Addressing(operand, loweredOperand) {
    debug2("classifySpc700Addressing", operand);
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
      return { mode: "imm", val: resolveValue(loweredOperand.baseExpression ?? loweredOperand.expanded) & 255 };
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
  isDpOrAbs(operand) {
    debug2("isDpOrAbs", operand);
    const cleaned = operand.replace(/\$/g, "");
    if (!/^[\dA-Fa-f]+$/.test(cleaned)) {
      return false;
    }
    return true;
  }
  /**
   * SHIFT, INC, DEC instructions. e.g. "ASL A" => 0x1C, "ASL $12+X" => 0x1B 12, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleShiftIncDec(opcode, operand, forcedLen, explicitlen) {
    debug2("handleShiftIncDec", { opcode, operand, forcedLen, explicitlen });
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
      debug2("handleShiftIncDec operand is A", { opcode, operand, write: table[upper].a.toString(16) });
      this.assembler.write1(table[upper].a);
      return true;
    }
    const plusX = operand.toUpperCase().endsWith("+X");
    if (plusX) {
      debug2("handleShiftIncDec operand ends with +X", { opcode, operand, write: table[upper].dpX.toString(16) });
      const baseStr = operand.replace(/\+x$/i, "").trim();
      debug2("handleShiftIncDec baseStr", baseStr);
      const val2 = parseInt(baseStr.replace(/\$/g, ""), 16) & 65535;
      debug2("handleShiftIncDec val", val2);
      if (explicitlen) {
        debug2("handleShiftIncDec explicitlen", { opcode, operand, forcedLen, explicitlen });
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
        debug2("handleShiftIncDec val <= 0xff", { opcode, operand, forcedLen, explicitlen, write: table[upper].dpX.toString(16) });
        this.assembler.write1(table[upper].dpX);
        this.assembler.write1(val2 & 255);
      } else {
        debug2("handleShiftIncDec val > 0xff", { opcode, operand, forcedLen, explicitlen, write: table[upper].abs.toString(16) });
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
   * Actually that's 2 "operands," but the test lumps them into a single comma-split line "BBS0 $12,Mylabel".
   * We'll handle that in handleTwoOperands.
   *
   * For "SETn $12 => 0x02 12" or "CLRn $12 => 0x12 12," that's one operand + the bit # is in the opcode name.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleBitSetClear(opcode, operand) {
    debug2("handleBitSetClear", { opcode, operand });
    const normalizedOpcode = opcode.toUpperCase();
    if (!hasOwn(bitSetClearOpcodes, normalizedOpcode)) {
      return false;
    }
    const val = parseInt(operand.replace(/\$/g, ""), 16) & 255;
    this.assembler.write1(bitSetClearOpcodes[normalizedOpcode]);
    this.assembler.write1(val);
    return true;
  }
  /**
   * BPL / BMI / BVC / BVS / BCC / BCS / BNE / BEQ / BRA => 1 operand (the label).
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleBranch(opcode, operand) {
    debug2("handleBranch", { opcode, operand });
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
    debug2("handleBranch targetAddr", targetAddr);
    const currentAddr = this.assembler.currentTargetAddress;
    debug2("handleBranch currentAddr", currentAddr);
    const offset = targetAddr - (currentAddr + 1);
    debug2("handleBranch offset", offset);
    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(255);
    } else {
      const unsignedOffset = offset < 0 ? 256 + offset : offset;
      debug2("handleBranch unsignedOffset", unsignedOffset);
      this.assembler.write1(unsignedOffset & 255);
    }
    return true;
  }
  /**
   * BBSn / BBCn => 2 operands: e.g. "BBC0 $12,Mylabel => 13 12 FF"
   * That logic is in handleTwoOperands because we have two comma-split sections.
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTwoOperandsBitBranch(opcode, left, right) {
    debug2("handleTwoOperandsBitBranch", { opcode, left, right });
    const bitOpcode = opcode.toUpperCase();
    if (!hasOwn(bitBranchOpcodes, bitOpcode)) {
      debug2("handleTwoOperandsBitBranch no match", { opcode, left, right });
      return false;
    }
    const dpVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
    debug2("handleTwoOperandsBitBranch =", bitBranchOpcodes[bitOpcode].toString(16));
    this.assembler.write1(bitBranchOpcodes[bitOpcode]);
    debug2("handleTwoOperandsBitBranch =", dpVal.toString(16));
    this.assembler.write1(dpVal);
    debug2("handleTwoOperandsBitBranch right", right);
    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(255);
    } else {
      let offset = 255;
      const target = this.assembler.operandResolver.getnum(right);
      const pc = this.assembler.currentTargetAddress;
      const relativeOffset = target - (pc + 1);
      offset = relativeOffset < 0 ? 256 + relativeOffset : relativeOffset;
      offset &= 255;
      debug2("handleTwoOperandsBitBranch =", offset.toString(16));
      this.assembler.write1(offset);
    }
    return true;
  }
  /**
   * e.g. DBNZ Y,Mylabel => FE offset, DBNZ $dp,Mylabel => 6E dp offset
   * also "CBNE $dp+X,Mylabel => DE dp offset" or "CBNE $dp,Mylabel => 2E dp offset"
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} _rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleDbnzCbne(opcode, left, right, leftLowered, _rightLowered) {
    debug2("handleDbnzCbne", { opcode, left, right });
    let offset;
    const target = this.assembler.operandResolver.getnum(right);
    offset = target - (this.assembler.currentTargetAddress + 3);
    debug2("handleDbnzCbne offset", offset);
    if (offset < -128 || offset > 127) {
      throw new Error(`Branch target out of range (${offset})`);
    }
    offset &= 255;
    if (opcode.toUpperCase() === "DBNZ") {
      if (isRegisterY(left, leftLowered)) {
        this.assembler.write1(254);
        this.assembler.write1(offset + 1);
        return true;
      } else {
        const val = parseInt(left.replace(/\$/g, ""), 16) & 255;
        this.assembler.write1(110);
        this.assembler.write1(val);
        this.assembler.write1(offset);
        return true;
      }
    }
    if (opcode.toUpperCase() === "CBNE") {
      const upper = left.toUpperCase();
      if (leftLowered?.mode === "directPageIndexedX" || upper.endsWith("+X")) {
        const base = upper.replace(/\+X$/, "").trim();
        const val = parseInt(base.replace(/\$/g, ""), 16) & 255;
        this.assembler.write1(222);
        this.assembler.write1(val);
        this.assembler.write1(offset);
        return true;
      } else {
        const val = parseInt(upper.replace(/\$/g, ""), 16) & 255;
        this.assembler.write1(46);
        this.assembler.write1(val);
        this.assembler.write1(offset);
        return true;
      }
    }
    return false;
  }
  /**
   * handle push/pop with single operand => e.g. PUSH A => 0x2D, PUSH X => 0x4D, etc.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handlePushPop(opcode, operand, loweredOperand) {
    debug2("handlePushPop", { opcode, operand });
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
   * handle call/jump instructions with single operand => e.g. "CALL $1234", "PCALL $12"
   * "JMP $1234", "JMP ($1234+X)"
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleCallJump(opcode, operand, loweredOperand) {
    debug2("handleCallJump", { opcode, operand });
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
      debug2("handleCallJump JMP trimmed", trimmed);
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
   * handle "CMP X,#$12" or "CMP X,$1234" or "MOV X,#$12" or "MOV Y,#$12" etc.
   * We see from the test code lines like:
   *  CMP X,#$12 => C8 12
   *  CMP X,$1234 => 1E 34 12
   *  CMP X,$12 => 3E 12
   *  MOV X,#$12 => CD 12
   *  MOV Y,#$12 => 8D 12
   *
   * We'll unify them here.
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleCmpXyOrMovXy(opcode, operand, forcedLen, explicitlen, leftLowered, rightLowered) {
    debug2("handleCmpXyOrMovXy", { opcode, operand, forcedLen, explicitlen });
    const upper = opcode.toUpperCase();
    if (upper === "CMP") {
      const upOp = operand.toUpperCase();
      const leftOperandIsX = leftLowered ? isRegisterX("", leftLowered) : upOp.startsWith("X,");
      const leftOperandIsY = leftLowered ? isRegisterY("", leftLowered) : upOp.startsWith("Y,");
      const tail = rightLowered ? rightLowered.expanded.toUpperCase() : leftOperandIsX || leftOperandIsY ? upOp.slice(2).trim() : "";
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
   * TSET / TCLR => e.g. "TSET $1234,A" => 0x0E 34 12
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleTsetTclr(opcode, left, right, rightLowered) {
    debug2("handleTsetTclr", { opcode, left, right });
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
   * handle e.g. "MOV X,A" or "MOV (X+),A" or "MOV $12,#$34".
   * Some are covered by memory instructions if the left side is A.
   * This function focuses on the big variety from the test lines.
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @param {number | null} forcedLen - the forced length
   * @param {boolean} explicitlen - whether the length is explicit
   * @returns {boolean} true if the instruction was handled, false otherwise
   */
  handleMovInstruction(left, right, forcedLen, explicitlen) {
    debug2("handleMovInstruction", { left, right, forcedLen, explicitlen });
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
      const opcode = explicitlen ? forcedLen === 1 ? mode.byte : mode.word : inferredLength === 1 ? mode.byte : mode.word;
      this.assembler.write1(opcode);
      if (opcode === mode.word) {
        this.assembler.write2(val);
      } else {
        this.assembler.write1(val & 255);
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
   * handle combos like "MOV ($12+X),A => 0xC7 12"
   * or "MOV ($12)+Y,A => 0xD7 12"
   * or "MOV A,($12+X) => 0xE7 12"
   * or "MOV A,($12)+Y => 0xF7 12"
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleMovMemoryCombo(left, right) {
    debug2("handleMovMemoryCombo", { left, right });
    const combined = `${left.trim()},${right.trim()}`.toUpperCase();
    debug2("handleMovMemoryCombo combined", combined);
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
   * handle combos like "MOV $1234+X,A => 0xD5 34 12", "MOV $12+X,A => 0xD4 12", etc.
   * or "MOV A,$1234+X => 0xF5 34 12" etc.
   * or "MOV $12+Y,X => 0xD9 12", etc.
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleMovMemoryCombo2(left, right) {
    debug2("handleMovMemoryCombo2", { left, right });
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
        this.assembler.write1(leftIndexed.length === 1 ? modes.dp : modes.abs);
        this.writeDpOrAbs(leftIndexed.value);
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
        this.assembler.write1(rightIndexed.length === 1 ? modes.dp : modes.abs);
        this.writeDpOrAbs(rightIndexed.value);
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
        const op = getAddressSize("$" + m[1]) === 1 ? p.opcodeDp : p.opcodeAbs;
        this.assembler.write1(op);
        this.writeDpOrAbs(val);
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
        const op = getAddressSize("$" + m[1]) === 1 ? p.opcodeDp : p.opcodeAbs;
        this.assembler.write1(op);
        this.writeDpOrAbs(val);
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
        const op = getAddressSize("$" + m[1]) === 1 ? p.opcodeDp : p.opcodeAbs;
        this.assembler.write1(op);
        this.writeDpOrAbs(val);
        return true;
      }
    }
    return false;
  }
  /**
   * handle e.g. "OR1 C,$1234" => 0x0A 34 12, "OR1 C,!$1234" => 0x2A 34 12,
   * "AND1 C,$1234" => 0x4A 34 12, "AND1 C,!$1234 => 0x6A 34 12, "EOR1 C,$1234 => 0x8A 34 12,
   * "MOV1 $1234,C => 0xCA 34 32" or "MOV1 C,$1234 => 0xAA 34 32"
   * "NOT1 $1234 => 0xEA 34 32"
   * @param {string} opcode - the opcode
   * @param {string} left - the left operand
   * @param {string} right - the right operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleBitManipulation(opcode, left, right) {
    debug2("handleBitManipulation", { opcode, left, right });
    const up = opcode.toUpperCase();
    if (up === "NOT1") {
      this.assembler.write1(234);
      const val2 = Number.parseInt(left.replace(/\$/g, ""), 16) & 65535;
      debug2("handleBitManipulation val", val2);
      const hibyte = val2 >> 8 & 255 | 32;
      const lobyte = val2 & 255;
      debug2("handleBitManipulation lobyte", lobyte.toString(16));
      debug2("handleBitManipulation hibyte", hibyte.toString(16));
      this.assembler.write1(lobyte);
      this.assembler.write1(hibyte);
      return true;
    }
    if (up === "MOV1") {
      const leftUp2 = left.trim().toUpperCase();
      const rightUp2 = right.trim().toUpperCase();
      let val2;
      if (leftUp2 === "C") {
        this.assembler.write1(170);
        val2 = parseInt(right.replace(/\$/g, ""), 16) & 65535;
      } else if (rightUp2 === "C") {
        this.assembler.write1(202);
        val2 = parseInt(left.replace(/\$/g, ""), 16) & 65535;
      } else {
        return false;
      }
      const hi2 = val2 >> 8 & 255 | 32;
      const lo2 = val2 & 255;
      this.assembler.write1(lo2);
      this.assembler.write1(hi2);
      return true;
    }
    if (!hasOwn(bit1Opcodes, up)) {
      return false;
    }
    const leftUp = left.trim().toUpperCase();
    const rightUp = right.trim().toUpperCase();
    let baseOpcode = bit1Opcodes[up];
    let val;
    let hasExclamation = false;
    if (leftUp === "C") {
      if (rightUp.startsWith("!$")) {
        hasExclamation = true;
        val = parseInt(rightUp.replace(/[^\da-f]/gi, ""), 16);
      } else {
        val = parseInt(rightUp.replace(/\$/g, ""), 16);
      }
    } else if (rightUp === "C") {
      if (leftUp.startsWith("!$")) {
        hasExclamation = true;
        val = parseInt(leftUp.replace(/[^\da-f]/gi, ""), 16);
      } else {
        val = parseInt(leftUp.replace(/\$/g, ""), 16);
      }
    } else {
      return false;
    }
    if (hasExclamation) {
      baseOpcode += 32;
    }
    this.assembler.write1(baseOpcode & 255);
    const hi = val >> 8 & 255 | 32;
    const lo = val & 255;
    this.assembler.write1(lo);
    this.assembler.write1(hi);
    return true;
  }
  /**
   * handle instructions with 1 operand that didn't match the prior sets, e.g. "DAA A => DF," "DAS A => BE," "MUL YA => CF," "DIV YA,X => 9E"
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleSingleOperandSpecial(opcode, operand) {
    debug2("handleSingleOperandSpecial", { opcode, operand });
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
    if (upOpcode === "NOT1") {
      return this.handleBitManipulation("NOT1", operand, "");
    }
    if (this.handleWordOps(upOpcode, operand)) {
      return true;
    }
    return false;
  }
  /**
   * e.g. "DECW $12 => 1A 12", "INCW $12 => 3A 12", "CMPW YA,$12 => 5A ???" => That's 2 operands though
   * We'll handle the single-operand forms: DECW dp => 1A dp, INCW dp => 3A dp
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @returns {boolean} true if the combo was handled, false otherwise
   */
  handleWordOps(opcode, operand) {
    debug2("handleWordOps", { opcode, operand });
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
   * Resolves the operand length from opcode suffix.
   * @param {string} c - the opcode suffix
   * @returns {number} the operand length
   */
  getlenfromchar(c) {
    debug2("getlenfromchar", c);
    switch (c.toLowerCase()) {
      case "b":
        return 1;
      case "w":
        return 2;
      case "l":
        return 3;
      case "d":
        debug2("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }
};

// src/ArchSuperFX.ts
var debug3 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug3 = d("ArchSuperFX");
} catch {
}
var hasOwn2 = (obj, key) => Object.hasOwn(obj, key);
var ArchSuperFX = class {
  assembler;
  constructor(assembler) {
    this.assembler = assembler;
  }
  /**
   * Returns the static Super FX instruction catalog for editor tooling.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog() {
    return superFxCatalog;
  }
  encode(words) {
    return this.asblock_superfx(words);
  }
  estimateInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  encodeInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operands,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  lowerInstructionFromCommand(command) {
    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? operandText.split(",").map((operand) => operand.trim()) : []);
    const loweredOperands = operands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    const loweredOperand = this.assembler.operandResolver.lowerOperand(operandText);
    return {
      kind: "instruction",
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
  estimateSize(words) {
    if (words.length === 0) {
      return 0;
    }
    return this.estimateResolvedInstruction(words[0], words.slice(1).join(" "));
  }
  estimateResolvedInstruction(mnemonic, operandText, loweredOperand, loweredOperands = []) {
    const opcode = mnemonic.toUpperCase();
    let size = 1;
    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const expandedOperand = firstLowered?.expanded ?? operandText;
    if (expandedOperand) {
      if (expandedOperand.startsWith("#")) {
        size = 2;
      } else if (expandedOperand.includes("$") || loweredOperands.length > 1 || expandedOperand.includes(",")) {
        size = 3;
      }
    }
    if (["JSL", "JML"].includes(opcode)) {
      size = 4;
    }
    return size;
  }
  /**
   * Processes a SuperFX assembly instruction.
   * @param {string[]} words The tokenized instruction.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_superfx(words) {
    debug3("asblock_superfx", words);
    if (words.length === 0) {
      return false;
    }
    const opcode = words[0];
    const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
    const parsedOperands = rawOperand ? rawOperand.split(",").map((operand) => operand.trim()) : [];
    const loweredOperand = this.assembler.operandResolver.lowerOperand(rawOperand);
    const loweredOperands = parsedOperands.map((operand) => this.assembler.operandResolver.lowerOperand(operand));
    return this.encodeResolvedInstruction(opcode, parsedOperands, loweredOperand, loweredOperands);
  }
  encodeResolvedInstruction(mnemonic, operands, loweredOperand, loweredOperands = []) {
    const opcode = mnemonic.toUpperCase();
    const firstLowered = loweredOperands[0] ?? loweredOperand;
    const secondLowered = loweredOperands[1];
    const operand = firstLowered?.expanded ?? "";
    const operandLength = firstLowered?.length ?? this.getOperandLength(operand);
    debug3("asblock_superfx opcode", opcode);
    debug3("asblock_superfx operand", operand);
    if (this.handleSingleWordOpcode(opcode)) {
      return true;
    }
    if (operands.length === 1 && this.handleTwoWordOpcode(opcode, operand, operandLength, firstLowered)) {
      return true;
    }
    if (operands.length === 1) {
      return this.handleOneOperandOpcode(opcode, operand, operandLength, firstLowered);
    } else if (operands.length === 2) {
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
   * Handles single-word (no-operand) opcodes for SuperFX.
   * @param {string} opcode - the opcode
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleSingleWordOpcode(opcode) {
    debug3("handleSingleWordOpcode", opcode);
    const singleOpcodes = {
      STOP: 0,
      NOP: 1,
      CACHE: 2,
      LSR: 3,
      ROL: 4,
      LOOP: 60,
      ALT1: 61,
      ALT2: 62,
      ALT3: 63,
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
    const extendedOpcodes = [
      { mnemonic: "RPIX", prefix: 61, opcode: 76 },
      { mnemonic: "CMODE", prefix: 61, opcode: 78 },
      { mnemonic: "DIV2", prefix: 61, opcode: 150 },
      { mnemonic: "LMULT", prefix: 61, opcode: 159 },
      { mnemonic: "GETBH", prefix: 61, opcode: 239 },
      { mnemonic: "RAMB", prefix: 62, opcode: 223 },
      { mnemonic: "GETBL", prefix: 62, opcode: 239 },
      { mnemonic: "ROMB", prefix: 63, opcode: 223 },
      { mnemonic: "GETBS", prefix: 63, opcode: 239 }
    ];
    if (hasOwn2(singleOpcodes, opcode)) {
      this.assembler.write1(singleOpcodes[opcode]);
      return true;
    }
    for (const cmd of extendedOpcodes) {
      if (opcode === cmd.mnemonic) {
        this.assembler.write1(cmd.prefix);
        this.assembler.write1(cmd.opcode);
        return true;
      }
    }
    return false;
  }
  /**
   * Handles two-word opcodes (one opcode + one operand).
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number} operandLength - the lowered operand length
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleTwoWordOpcode(opcode, operand, operandLength, loweredOperand) {
    debug3("handleTwoWordOpcode", opcode, operand);
    return this.handleOneOperandOpcode(opcode, operand, operandLength, loweredOperand);
  }
  /**
   * Handles instructions with a single operand (e.g., "TO R1", "BRA label").
   * @param {string} opcode - the opcode
   * @param {string} operand - the operand
   * @param {number} operandLength - the length of the operand
   * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleOneOperandOpcode(opcode, operand, operandLength, loweredOperand) {
    debug3("handleOneOperandOpcode", opcode, operand, operandLength);
    const shortBranchMap = {
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
    if (hasOwn2(shortBranchMap, opcode)) {
      const branchOpcode = shortBranchMap[opcode];
      const val = this.assembler.operandResolver.getnum(operand);
      if (operandLength === 1) {
        this.assembler.write1(branchOpcode);
        this.assembler.write1(val & 255);
      } else {
        const pc = this.assembler.currentTargetAddress & 16777215;
        const offset = val - (pc + 2) & 255;
        this.assembler.write1(branchOpcode);
        this.assembler.write1(offset);
      }
      return true;
    }
    const regR = this.resolveRegister(operand, loweredOperand, "r");
    const regHash = this.resolveRegister(operand, loweredOperand, "hash");
    const regParr = this.resolveRegister(operand, loweredOperand, "parr");
    if (regR !== null) {
      switch (opcode) {
        case "TO":
          this.assembler.write1(16 + regR);
          return true;
        case "WITH":
          this.assembler.write1(32 + regR);
          return true;
        case "ADD":
          this.assembler.write1(80 + regR);
          return true;
        case "SUB":
          this.assembler.write1(96 + regR);
          return true;
        case "AND":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(112 + regR);
          return true;
        case "MULT":
          this.assembler.write1(128 + regR);
          return true;
        case "JMP":
          this.rangeCheck(8, regR, 13);
          this.assembler.write1(144 + regR);
          return true;
        case "FROM":
          this.assembler.write1(176 + regR);
          return true;
        case "OR":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(192 + regR);
          return true;
        case "INC":
          this.rangeCheck(0, regR, 14);
          this.assembler.write1(208 + regR);
          return true;
        case "DEC":
          this.rangeCheck(0, regR, 14);
          this.assembler.write1(224 + regR);
          return true;
        // ALT1 variants (0x3D prefix)
        case "ADC":
          this.assembler.write1(61);
          this.assembler.write1(80 + regR);
          return true;
        case "SBC":
          this.assembler.write1(61);
          this.assembler.write1(96 + regR);
          return true;
        case "BIC":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(61);
          this.assembler.write1(112 + regR);
          return true;
        case "UMULT":
          this.assembler.write1(61);
          this.assembler.write1(128 + regR);
          return true;
        case "LJMP":
          this.rangeCheck(8, regR, 13);
          this.assembler.write1(61);
          this.assembler.write1(144 + regR);
          return true;
        case "XOR":
          this.rangeCheck(1, regR, 15);
          this.assembler.write1(61);
          this.assembler.write1(192 + regR);
          return true;
        case "CMP":
          this.assembler.write1(63);
          this.assembler.write1(96 + regR);
          return true;
      }
    }
    if (regHash !== null) {
      if (opcode === "LINK") {
        this.rangeCheck(1, regHash, 4);
        this.assembler.write1(144 + regHash);
        return true;
      }
      switch (opcode) {
        case "ADD":
          this.assembler.write1(62);
          this.assembler.write1(80 + regHash);
          return true;
        case "SUB":
          this.assembler.write1(62);
          this.assembler.write1(96 + regHash);
          return true;
        case "AND":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(62);
          this.assembler.write1(112 + regHash);
          return true;
        case "MULT":
          this.assembler.write1(62);
          this.assembler.write1(128 + regHash);
          return true;
        case "OR":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(62);
          this.assembler.write1(192 + regHash);
          return true;
        // ALT3 prefix
        case "ADC":
          this.assembler.write1(63);
          this.assembler.write1(80 + regHash);
          return true;
        case "BIC":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(63);
          this.assembler.write1(112 + regHash);
          return true;
        case "UMULT":
          this.assembler.write1(63);
          this.assembler.write1(128 + regHash);
          return true;
        case "XOR":
          this.rangeCheck(1, regHash, 15);
          this.assembler.write1(63);
          this.assembler.write1(192 + regHash);
          return true;
      }
    }
    if (regParr !== null) {
      switch (opcode) {
        case "STW":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(48 + regParr);
          return true;
        case "LDW":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(64 + regParr);
          return true;
        case "STB":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(61);
          this.assembler.write1(48 + regParr);
          return true;
        case "LDB":
          this.rangeCheck(0, regParr, 11);
          this.assembler.write1(61);
          this.assembler.write1(64 + regParr);
          return true;
      }
    }
    return false;
  }
  /**
   * Handles instructions with two operands (e.g., MOVE r1, r2).
   * @param {string} opcode - the opcode
   * @param {string} leftOp - the left operand
   * @param {string} rightOp - the right operand
   * @param {LoweredOperand} leftLowered - optional lowered metadata for left operand
   * @param {LoweredOperand} rightLowered - optional lowered metadata for right operand
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  handleTwoOperandOpcode(opcode, leftOp, rightOp, leftLowered, rightLowered) {
    debug3("handleTwoOperandOpcode", { opcode, leftOp, rightOp });
    const reg1r = this.resolveRegister(leftOp, leftLowered, "r");
    const reg1parr = this.resolveRegister(leftOp, leftLowered, "parr");
    const reg2r = this.resolveRegister(rightOp, rightLowered, "r");
    const reg2parr = this.resolveRegister(rightOp, rightLowered, "parr");
    debug3("handleTwoOperandOpcode", { reg1r, reg1parr, reg2r, reg2parr });
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
          if (immVal < 128 || immVal >= 65408) {
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
          if (reg1parr === 0) {
            this.assembler.write1(61);
            this.assembler.write1(48 + reg2r);
            return true;
          } else {
            this.assembler.write1(176 + reg1parr);
            this.assembler.write1(61);
            this.assembler.write1(48 + reg2r);
            return true;
          }
        case "MOVEW":
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
          if (reg2parr === 0) {
            this.assembler.write1(61);
            this.assembler.write1(64 + reg1r);
            return true;
          } else {
            this.assembler.write1(16 + reg1r);
            this.assembler.write1(61);
            this.assembler.write1(64 + reg2parr);
            return true;
          }
        case "MOVEW":
          if (reg2parr === 0) {
            this.assembler.write1(64 + reg1r);
            return true;
          } else {
            this.assembler.write1(16 + reg1r);
            this.assembler.write1(64 + reg2parr);
            return true;
          }
      }
    }
    if (reg1r !== null) {
      const addrVal = this.assembler.operandResolver.getnum(rightOp);
      switch (opcode) {
        case "LM":
          this.assembler.write1(61);
          this.assembler.write1(240 + reg1r);
          this.assembler.write2(addrVal);
          return true;
        case "LMS":
          if (this.checkShortAddr(addrVal)) {
            this.assembler.write1(61);
            this.assembler.write1(160 + reg1r);
            this.assembler.write1(addrVal >> 1);
            return true;
          }
          return true;
        // might not do anything else if fail
        case "MOVE":
          if (addrVal & 1 || addrVal >= 512) {
            this.assembler.write1(61);
            this.assembler.write1(240 + reg1r);
            this.assembler.write2(addrVal);
          } else {
            this.assembler.write1(61);
            this.assembler.write1(160 + reg1r);
            this.assembler.write1(addrVal & 255);
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
          this.assembler.write1(62);
          this.assembler.write1(240 + reg2r);
          this.assembler.write2(addrVal);
          return true;
        case "SMS":
          if (this.checkShortAddr(addrVal)) {
            this.assembler.write1(62);
            this.assembler.write1(160 + reg2r);
            this.assembler.write1(addrVal >> 1);
            return true;
          }
          return true;
        case "MOVE":
          if (addrVal & 1 || addrVal >= 512) {
            this.assembler.write1(62);
            this.assembler.write1(240 + reg2r);
            this.assembler.write2(addrVal);
          } else {
            this.assembler.write1(62);
            this.assembler.write1(160 + reg2r);
            this.assembler.write1(addrVal & 255);
          }
          return true;
      }
    }
    return false;
  }
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
        const regnum = this.assembler.operandResolver.getnum(lowered.baseExpression ?? lowered.expanded.slice(1));
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
        debug3("Invalid register number", str, regnum);
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
   * @param {number} max The maximum value.
   * @throws {Error} If the middle value is out of range.
   */
  rangeCheck(min, mid, max) {
    if (mid < min || mid > max) {
      throw new Error(`Register out of valid range ${min}-${max}: ${mid}`);
    }
  }
  /**
   * For "LMS" or "SMS" short addressing forms, we need to ensure the address is
   * even and in range [0x000..0x1FE].
   * @param {number} num - the address
   * @returns {boolean} True if the address is valid, false otherwise.
   */
  checkShortAddr(num) {
    debug3("checkShortAddr", num);
    if (num % 2 !== 0 || num < 0 || num > 510) {
      throw new Error(
        `Invalid short address ${num}. Must be even and in range 0..0x1FE`
      );
    }
    return true;
  }
  /**
   * Returns an approximate operand length (1 or 2) by checking the operand format.
   * This is a simple approximation for short vs. relative addressing.
   * @param {string} operand the operand
   * @returns {number} The operand length.
   */
  getOperandLength(operand) {
    const simpleHex2 = /^\$[\dA-Fa-f]{2}$/;
    if (simpleHex2.test(operand)) {
      return 1;
    }
    return 2;
  }
};

// src/compatibility/asar-compatibility-profile.ts
var ASAR_COMPAT_NO_OP_DIRECTIVES = [
  "dpbase",
  "warnings",
  "print",
  "autoclean",
  "autoclear",
  "table",
  "includefrom",
  "asar",
  "{",
  "}"
];
var shouldRedirectOrgToSpcblock = (spcInlineCompatMode) => spcInlineCompatMode;
var shouldEndifCloseInnermostWhile = (currentLoopType, currentLoopStartLine, currentIfStartLine) => currentLoopType === "while" && (currentIfStartLine === void 0 || (currentLoopStartLine ?? -1) >= currentIfStartLine);

// src/addr2line.ts
import * as fs from "fs";

// src/crc32.ts
var CRC32 = class _CRC32 {
  // Precomputed CRC32 table.
  static table = _CRC32.makeCRCTable();
  // Builds the lookup table used for CRC32 computation.
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

// src/addr2line.ts
var debug4 = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug4 = d("Addr2Line");
} catch {
}
function readFileContent(filename) {
  try {
    return fs.readFileSync(filename);
  } catch (err) {
    debug4(`Error reading file ${filename}:`, err);
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

// src/source-location.ts
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

// src/diagnostics.ts
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

// src/ir/expression-node.ts
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
  const rangeIndex = findTopLevelRange(trimmed);
  if (rangeIndex !== -1) {
    return attachRootSpan({
      type: "range",
      start: parseExpressionNode(trimmed.slice(0, rangeIndex)),
      end: parseExpressionNode(trimmed.slice(rangeIndex + 2))
    }, trimmed);
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
      const index2 = options.renderIndex ? options.renderIndex(node.index) : renderExpressionNode(node.index);
      return `${renderReferenceExpressionNode(node.object, options)}[${index2}]`;
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
      return i;
    }
  }
  return -1;
}
function scanReferenceExpressionPrefix(input) {
  let index2 = 0;
  index2 = skipWhitespace(input, index2);
  if (index2 >= input.length) {
    return 0;
  }
  const root = scanReferenceRoot(input, index2);
  if (root === index2) {
    return 0;
  }
  index2 = root;
  while (index2 < input.length) {
    const lookahead = skipWhitespace(input, index2);
    if (input[lookahead] === ".") {
      let memberStart = lookahead + 1;
      memberStart = skipWhitespace(input, memberStart);
      const propertyEnd = readIdentifier(input, memberStart).nextIndex;
      if (propertyEnd === memberStart) {
        return memberStart;
      }
      index2 = propertyEnd;
      continue;
    }
    if (input[lookahead] === "[") {
      const bracketEnd = findMatchingBracket(input, lookahead);
      if (bracketEnd === -1) {
        return 0;
      }
      index2 = bracketEnd + 1;
      continue;
    }
    break;
  }
  return index2;
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
  for (let index2 = start; index2 < input.length; index2++) {
    const char = input[index2];
    if ((char === '"' || char === "'") && input[index2 - 1] !== "\\") {
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
        return index2;
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
function skipWhitespace(input, index2) {
  let current = index2;
  while (current < input.length && /\s/.test(input[current])) {
    current++;
  }
  return current;
}
var binaryPrecedence = {
  "||": 0,
  "&&": 1,
  "==": 2,
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
var unaryOperators = /* @__PURE__ */ new Set(["<:", "~", "-", "+"]);
var binaryOperators = [
  "**",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
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
  let index2 = 0;
  while (index2 < input.length) {
    const char = input[index2];
    if (/\s/.test(char)) {
      index2++;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      index2++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      index2++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index2++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "dot" });
      index2++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket" });
      index2++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket" });
      index2++;
      continue;
    }
    if (char === '"' || char === "'") {
      const { value, nextIndex, quote } = readQuotedString(input, index2);
      tokens.push({ type: "string", value, quote });
      index2 = nextIndex;
      continue;
    }
    const operator = (input.startsWith("<:", index2) ? "<:" : void 0) ?? binaryOperators.find((candidate) => input.startsWith(candidate, index2));
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      index2 += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input, index2);
      tokens.push(token);
      index2 = nextIndex;
      continue;
    }
    if (char === "$") {
      const match = input.slice(index2).match(/^\$[\dA-Fa-f]+/);
      if (!match) {
        throw new Error("Invalid hex literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index2 += match[0].length;
      continue;
    }
    if (char === "%") {
      const match = input.slice(index2).match(/^%[01]+/);
      if (!match) {
        throw new Error("Invalid binary literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index2 += match[0].length;
      continue;
    }
    if (/\d/.test(char)) {
      const match = input.slice(index2).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
      if (!match) {
        throw new Error("Invalid numeric literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index2 += match[0].length;
      continue;
    }
    if (/[A-Z_a-z]/.test(char)) {
      const { value, nextIndex } = readIdentifier(input, index2);
      tokens.push({ type: "identifier", value });
      index2 = nextIndex;
      continue;
    }
    throw new Error(`Unexpected token '${char}'`);
  }
  return tokens;
}
function readQuotedString(input, start) {
  const quote = input[start];
  let value = "";
  let index2 = start + 1;
  while (index2 < input.length) {
    const char = input[index2];
    if (char === quote && input[index2 - 1] !== "\\") {
      return { value, nextIndex: index2 + 1, quote };
    }
    value += char;
    index2++;
  }
  throw new Error("Unterminated string literal");
}
function readIdentifier(input, start) {
  let index2 = start;
  while (index2 < input.length && /\w/.test(input[index2])) {
    index2++;
  }
  return { value: input.slice(start, index2), nextIndex: index2 };
}
function readDefineReference(input, start) {
  if (input[start + 1] === "{") {
    let index2 = start + 2;
    let braces = 1;
    let content = "";
    while (index2 < input.length) {
      const char = input[index2];
      if (char === "{") {
        braces++;
      } else if (char === "}") {
        braces--;
        if (braces === 0) {
          return {
            token: { type: "defineReference", content, braced: true },
            nextIndex: index2 + 1
          };
        }
      }
      content += char;
      index2++;
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
  isAtEnd() {
    return this.index >= this.tokens.length;
  }
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
  parsePrimary() {
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
  expect(type) {
    const token = this.consume();
    if (!token || token.type !== type) {
      throw new Error(`Expected token ${type}`);
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

// src/ir/normalized-command.ts
function createCommandProvenance(raw, normalized, words, file, line) {
  return {
    file,
    line,
    raw,
    normalized,
    span: createLineSpan(raw, line),
    normalizedSpan: createLineSpan(normalized, line),
    tokenSpans: deriveTokenSpans(normalized, words, line)
  };
}
function createNormalizedCommand(raw, normalized, words, file, line) {
  const command = normalized.trim();
  const keyword = words[0] ?? "";
  return {
    kind: classifyCommand(command, words),
    source: createCommandProvenance(raw, normalized, words, file, line),
    command,
    words,
    keyword,
    labelName: deriveLabelName(keyword),
    assignmentTarget: deriveAssignmentTarget(words),
    parsed: deriveCommandSemantics(command, words)
  };
}
function cloneNormalizedCommand(command) {
  return createNormalizedCommand(
    command.source.raw,
    command.source.normalized,
    [...command.words],
    command.source.file,
    command.source.line
  );
}
function setCommandWords(command, words, normalized) {
  command.words = words;
  command.keyword = words[0] ?? "";
  command.command = (normalized ?? words.join(" ")).trim();
  command.source.normalized = normalized ?? command.command;
  command.source.normalizedSpan = createLineSpan(command.source.normalized, command.source.line);
  command.source.tokenSpans = deriveTokenSpans(command.source.normalized, words, command.source.line);
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
  if (keyword === "macro" || keyword.startsWith("%")) {
    return "macroDefinitionOrInvoke";
  }
  if (keyword === "struct" || keyword === "endstruct") {
    return "structCommand";
  }
  if (words.length === 3 && words[1] === "=") {
    return "staticAssignment";
  }
  if (deriveLabelName(words[0] ?? "")) {
    return "labelDefinition";
  }
  return "unknown";
}
function deriveLabelName(keyword) {
  if (!keyword) {
    return void 0;
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
  if (words.length === 3 && words[1] === "=") {
    return words[0];
  }
  return void 0;
}
function deriveCommandSemantics(command, words) {
  const keyword = (words[0] ?? "").toLowerCase();
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
  if (words.length === 3 && words[1] === "=" && !(words[0]?.startsWith("'") || words[0]?.startsWith('"'))) {
    semantics.assignment = {
      target: words[0],
      expression: parseExpressionNode(words[2])
    };
  }
  if (keyword === "incbin" && words.length >= 2) {
    const rangeCandidate = extractIncbinRange(words[1]);
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
  if ((keyword === "include" || keyword === "incsrc") && words.length >= 2) {
    semantics.includeTarget = {
      directive: keyword,
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
    semantics.directiveArgs = {
      name: keyword,
      args: payload ? splitCommaArguments(payload) : []
    };
    if (!deriveLabelName(words[0] ?? "") && payload) {
      semantics.opcodeOperands = {
        mnemonic: words[0] ?? "",
        operandText: payload,
        operands: splitCommaArguments(payload)
      };
    }
  }
  return semantics;
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

// src/mathcore.ts
var debug5 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug5 = d("MathCore");
} catch {
}
function escapeRegExp(value) {
  return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}
var MathCore = class {
  host;
  math_round = false;
  userFunctions = /* @__PURE__ */ new Map();
  builtInFunctions = /* @__PURE__ */ new Map([
    ["sqrt", Math.sqrt],
    ["sin", Math.sin],
    ["cos", Math.cos],
    ["tan", Math.tan],
    ["asin", Math.asin],
    ["acos", Math.acos],
    ["atan", Math.atan],
    ["log", Math.log],
    ["log10", Math.log10],
    ["log2", Math.log2],
    ["ceil", Math.ceil],
    ["floor", Math.floor]
  ]);
  operators = {
    "**": { priority: 6, operation: (a, b) => Math.pow(a, b) },
    "*": { priority: 5, operation: (a, b) => a * b },
    "/": { priority: 5, operation: (a, b) => b !== 0 ? a / b : this.throwMathError("Division by zero") },
    "%": { priority: 5, operation: (a, b) => b !== 0 ? a % b : this.throwMathError("Modulo by zero") },
    "+": { priority: 4, operation: (a, b) => a + b },
    "-": { priority: 4, operation: (a, b) => a - b },
    "<<": { priority: 3, operation: (a, b) => a << b },
    ">>": { priority: 3, operation: (a, b) => a >> b },
    "&": { priority: 3, operation: (a, b) => a & b },
    "|": { priority: 3, operation: (a, b) => a | b },
    "^": { priority: 3, operation: (a, b) => a ^ b },
    "<": { priority: 2, operation: (a, b) => a < b ? 1 : 0 },
    ">": { priority: 2, operation: (a, b) => a > b ? 1 : 0 },
    "<=": { priority: 2, operation: (a, b) => a <= b ? 1 : 0 },
    ">=": { priority: 2, operation: (a, b) => a >= b ? 1 : 0 },
    "==": { priority: 2, operation: (a, b) => a === b ? 1 : 0 },
    "!=": { priority: 2, operation: (a, b) => a !== b ? 1 : 0 },
    "&&": { priority: 1, operation: (a, b) => a && b ? 1 : 0 },
    "||": { priority: 0, operation: (a, b) => a || b ? 1 : 0 }
  };
  str = "";
  constructor() {
  }
  /**
   * Initialize the math core.
   */
  reset() {
    debug5("reset");
    this.math_round = false;
    this.userFunctions.clear();
  }
  /**
   * Evaluates an expression.
   * This is a direct conversion of `math` in `asar_math.cpp`.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  math = (expression) => {
    if (typeof expression !== "string") {
      return this.evaluateExpressionNode(expression);
    }
    return this.evaluateStringExpression(expression);
  };
  /**
   * Evaluates a string expression using the legacy parser.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateStringExpression(expression) {
    debug5("math", expression);
    this.str = expression.trim();
    const rval = this.evalMath(0);
    if (this.str.length > 0) {
      if (this.str.startsWith(",")) {
        throw new AssemblyError("MATH_INVALID_INPUT", `Invalid input: ${this.str}`);
      } else {
        throw new AssemblyError("MATH_MISMATCHED_PARENTHESES", "Mismatched parentheses.");
      }
    }
    debug5(`math: ${expression} = ${rval}`);
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
        throw new AssemblyError("MATH_STRING_NOT_NUMERIC", `String expression is not directly numeric: ${expression.value}`);
      case "call":
        return this.callFunction(
          expression.callee.name,
          expression.arguments.map((argument, index2) => this.evaluateCallArgument(expression.callee.name, index2, argument))
        );
      case "unary": {
        const unaryExpression = expression;
        return this.evaluateUnaryExpressionNode(unaryExpression.operator, unaryExpression.argument);
      }
      case "binary": {
        const binaryExpression = expression;
        return this.evaluateBinaryExpressionNode(binaryExpression.operator, binaryExpression.left, binaryExpression.right);
      }
      case "range":
        throw new AssemblyError("MATH_RANGE_NOT_NUMERIC", `Range expression is not directly numeric: ${renderExpressionNode(expression)}`);
      case "raw":
      default:
        return this.evaluateStringExpression(expression.value);
    }
  }
  evaluateCallArgument(functionName, argumentIndex, argument) {
    if (this.isStringArgument(functionName, argumentIndex)) {
      switch (argument.type) {
        case "identifier":
          return argument.name;
        case "string": {
          const stringArgument = argument;
          return stringArgument.value;
        }
        case "raw": {
          const rawArgument = argument;
          return rawArgument.value.replace(/^["']|["']$/g, "");
        }
        default:
          return renderExpressionNode(argument);
      }
    }
    switch (argument.type) {
      case "string": {
        const stringArgument = argument;
        return stringArgument.value;
      }
      case "range":
        return renderExpressionNode(argument);
      case "raw":
        return this.evaluateStringExpression(argument.value);
      default:
        if (isReferenceExpressionNode(argument)) {
          return argument.type === "defineReference" ? renderReferenceExpressionNode(argument) : this.resolveNumericIdentifierArgument(this.renderReference(argument));
        }
        return this.evaluateExpressionNode(argument);
    }
  }
  evaluateUnaryExpressionNode(operator, argument) {
    const value = this.evaluateExpressionNode(argument);
    switch (operator) {
      case "<:":
        return value >>> 16;
      case "~":
        return ~value;
      case "-":
        return -value;
      case "+":
      default:
        return value;
    }
  }
  evaluateBinaryExpressionNode(operator, left, right) {
    const operation = this.operators[operator];
    if (!operation) {
      throw new AssemblyError("MATH_UNSUPPORTED_BINARY_OPERATOR", `Unsupported binary operator '${operator}'`);
    }
    return operation.operation(this.evaluateExpressionNode(left), this.evaluateExpressionNode(right));
  }
  resolveNumericIdentifierArgument(identifier) {
    try {
      const resolved = this.getHost().resolveLabel(identifier);
      return typeof resolved === "number" ? resolved : identifier;
    } catch {
      return identifier;
    }
  }
  evaluateReferenceExpressionNode(expression) {
    if (expression.type === "defineReference") {
      throw new Error(`Unresolved define reference: ${renderReferenceExpressionNode(expression)}`);
    }
    const reference = this.renderReference(expression);
    const resolved = this.getHost().resolveLabel(reference);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${reference}' did not resolve to a numeric value.`);
  }
  renderReference(expression) {
    return renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.evaluateExpressionNode(node).toString()
    });
  }
  resolveLeadingLocalLabelReference(input) {
    const match = input.match(/^(\.+\w+)/);
    if (!match) {
      return void 0;
    }
    return { label: match[1], length: match[1].length };
  }
  isStringArgument(functionName, argumentIndex) {
    if (["defined", "sizeof", "objectsize", "datasize", "filesize", "getfilestatus"].includes(functionName)) {
      return argumentIndex === 0;
    }
    if (["stringsequal", "stringsequalnocase"].includes(functionName)) {
      return argumentIndex < 2;
    }
    if (/^(?:canreadfile|readfile)\d?$/.test(functionName)) {
      return argumentIndex === 0;
    }
    return false;
  }
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
   * @returns {number} The result of the evaluated expression.
   */
  evalMath(depth = 0, stopChar) {
    debug5("evalMath", { depth, stopChar }, this.str);
    let left;
    if (this.str.startsWith("function")) {
      this.parseFunctionDefinition();
      left = this.evalMath(depth, stopChar);
    } else if (this.str.length > 0) {
      left = this.getnum();
    }
    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug5("evalMath after getnum", left);
    this.str = this.str.trim();
    while (this.str.trim().length > 0) {
      this.str = this.str.trim();
      if (stopChar && this.str.startsWith(stopChar)) {
        break;
      }
      if ([",", ")", "]"].includes(this.str[0])) {
        break;
      }
      const op = this.peekNextOperator(this.operators, depth);
      debug5("evalMath peekNextOperator =", op);
      if (!op) break;
      this.str = this.str.substring(op.length).trim();
      const right = this.evalMath(this.operators[op].priority + 1, stopChar);
      debug5("evalMath right =", { right, op, left });
      left = this.operators[op].operation(left, right);
    }
    if (this.math_round) {
      left = Math.trunc(left);
    }
    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug5("evalMath =", left);
    return left;
  }
  /**
   * Helper function to peek ahead at the next 1-2 characters and return a matching operator if found and depth-allowed.
   * @param {object} operators The operators to check.
   * @param {number} depth The current depth of nested expressions.
   * @returns {string | null} The matching operator or null if no match.
   */
  peekNextOperator(operators, depth) {
    this.str = this.str.trim();
    if (this.str.length === 0) {
      debug5("peekNextOperator = null", this.str);
      return null;
    }
    if (this.str.length >= 2) {
      const twoChars = this.str.slice(0, 2);
      if (operators[twoChars]) {
        debug5("peekNextOperator twoChars", twoChars);
        return twoChars;
      }
    }
    const oneChar = this.str[0];
    if (operators[oneChar] && operators[oneChar].priority >= depth) {
      debug5("peekNextOperator oneChar", oneChar);
      return oneChar;
    }
    debug5("peekNextOperator = null", this.str);
    return null;
  }
  /**
   * Parses numbers from a string while consuming valid characters.
   * @param {RegExp} regex The regular expression to test against the string.
   * @returns {string} The substring of the string that matches the regular expression.
   */
  consumeWhile(regex) {
    debug5("consumeWhile", regex);
    let i = 0;
    while (i < this.str.length && regex.test(this.str[i])) {
      i++;
    }
    const result = this.str.substring(0, i);
    this.str = this.str.substring(i);
    return result;
  }
  /**
   * Retrieves a number from the string.
   * This implements `getnumcore` and `getnum`.
   * @returns {number} The number from the string.
   */
  getnum = () => {
    debug5("getnum:", this.str);
    this.str = this.str.trim();
    let applyBitshift = false;
    let sign = 1;
    while (true) {
      if (this.str.startsWith("<:")) {
        this.str = this.str.substring(2).trim();
        applyBitshift = true;
      } else if (this.str.startsWith("~")) {
        this.str = this.str.substring(1).trim();
        return ~this.getnum();
      } else if (this.str.startsWith("-")) {
        this.str = this.str.substring(1).trim();
        sign *= -1;
      } else if (this.str.startsWith("+")) {
        this.str = this.str.substring(1).trim();
      } else {
        break;
      }
    }
    const structFns = ["sizeof", "objectsize"];
    for (const fn of structFns) {
      const prefix = fn + "(";
      if (this.str.startsWith(prefix)) {
        this.str = this.str.substring(prefix.length).trim();
        let param = "";
        if (this.str.startsWith('"')) {
          this.str = this.str.substring(1).trim();
          const endQuoteIndex = this.str.indexOf('"');
          if (endQuoteIndex === -1) {
            throw new Error(`Missing closing double quote in ${fn} call.`);
          }
          param = this.str.substring(0, endQuoteIndex);
          this.str = this.str.substring(endQuoteIndex + 1).trim();
        } else {
          param = this.consumeWhile(/[\w.]/);
        }
        if (!this.str.startsWith(")")) {
          throw new Error(`Missing closing ')' in ${fn} call.`);
        }
        const remainingAfterCall = this.str.substring(1).trim();
        const result = this.callFunction(fn, [param]);
        this.str = remainingAfterCall;
        debug5("getnum leftover after struct fn:", this.str);
        let value2 = sign * result;
        if (applyBitshift) {
          value2 = value2 >>> 16;
        }
        return value2;
      }
    }
    const funcCallMatch = this.str.match(/^(\w+)\s*\(/);
    if (funcCallMatch) {
      debug5("getnum function:", funcCallMatch);
      const fnName = funcCallMatch[1];
      debug5("getnum fnName =", fnName);
      this.str = this.str.substring(funcCallMatch[0].length - 1).trim();
      debug5("getnum this.str =", this.str);
      const args = [];
      if (this.str[0] === "(") {
        this.str = this.str.substring(1).trim();
        if (!this.str.startsWith(")")) {
          while (true) {
            this.str = this.str.trim();
            if (this.str.startsWith(",")) {
              this.str = this.str.substring(1).trim();
            }
            debug5("getnum this.str while 1 =", this.str);
            if (this.str.startsWith(")")) {
              break;
            }
            if (this.str.startsWith('"')) {
              const strVal = this.parseStringLiteral();
              args.push(strVal);
            } else {
              const val = this.evalMath(0, ")");
              args.push(val);
            }
            this.str = this.str.trim();
            debug5("getnum this.str while 2 =", this.str);
            if (this.str.startsWith(")")) {
              break;
            }
            if (this.str.startsWith(",")) {
              this.str = this.str.substring(1).trim();
              continue;
            } else {
              throw new Error(`Expected ',' or ')' in function call arguments: ${this.str}`);
            }
          }
        }
        const remainingAfterCall = this.str.substring(1).trim();
        const result = this.callFunction(fnName, args);
        debug5("getnum result =", result);
        this.str = remainingAfterCall;
        debug5("getnum leftover string =", this.str);
        let value2 = sign * result;
        if (applyBitshift) {
          value2 = value2 >>> 16;
        }
        return value2;
      }
    }
    let value;
    if (this.str.startsWith("(")) {
      this.str = this.str.substring(1).trim();
      value = this.evalMath(0, ")");
      debug5("getnum this.str", this.str);
      if (!this.str.startsWith(")")) {
        throw new Error("Mismatched parentheses.");
      }
      this.str = this.str.substring(1).trim();
    } else if (this.str.startsWith("$")) {
      this.str = this.str.substring(1);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.str.startsWith("0x")) {
      this.str = this.str.substring(2);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.str.startsWith("%")) {
      this.str = this.str.substring(1);
      value = parseInt(this.consumeWhile(/[01]/), 2);
    } else if (/\d/.test(this.str[0])) {
      value = parseFloat(this.consumeWhile(/[\d.]/));
    } else {
      const reference = parseLeadingReferenceExpression(this.str);
      if (reference) {
        this.str = this.str.substring(reference.length).trim();
        const resolved = this.getHost().resolveLabel(this.renderReference(reference.node));
        if (typeof resolved === "number") {
          value = resolved;
        } else {
          return resolved;
        }
      } else {
        const localReference = this.resolveLeadingLocalLabelReference(this.str);
        if (localReference) {
          this.str = this.str.substring(localReference.length).trim();
          const resolved = this.getHost().resolveLabel(localReference.label);
          if (typeof resolved === "number") {
            value = resolved;
          } else {
            return resolved;
          }
        } else {
          const rootMatch = this.str.match(/^([A-Z_a-z]\w*)/);
          if (rootMatch && this.str.substring(rootMatch[1].length).trimStart().startsWith("[")) {
            throw new Error("Mismatched brackets in struct index");
          }
          throw new Error(`Invalid number: ${this.str}`);
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
   * Safe wrapper to handle division by zero.
   * @param {string} message The message to throw.
   */
  throwMathError = (message) => {
    throw new AssemblyError("MATH_EVALUATION_ERROR", message);
  };
  /**
   * Parses a string literal from the current string with support for quotes.
   * @returns {string} The parsed string literal.
   */
  parseStringLiteral = () => {
    debug5("parseStringLiteral");
    let i = 1;
    let result = "";
    while (i < this.str.length && this.str[i] !== '"') {
      result += this.str[i];
      i++;
    }
    if (i >= this.str.length) {
      throw new Error("Unterminated string literal in function call.");
    }
    i++;
    this.str = this.str.substring(i).trim();
    return result;
  };
  /**
   * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callFunction = (name, args) => {
    debug5("callFunction", { name, args });
    if (this.userFunctions.has(name)) {
      return this.callUserFunction(name, args);
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
    debug5("callUserFunction", { name, args });
    const func = this.userFunctions.get(name);
    if (!func) {
      throw new Error(`User function '${name}' not found.`);
    }
    if (args.length < func.args.length) {
      throw new Error(
        `Function '${name}' expects at least ${func.args.length} argument(s).`
      );
    }
    let content = func.content;
    for (let i = 0; i < func.args.length; i++) {
      const paramName = func.args[i];
      const argValue = args[i];
      const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, "g");
      const replacement = typeof argValue === "string" ? JSON.stringify(argValue) : argValue.toString();
      content = content.replace(regex, replacement);
    }
    debug5("callUserFunction content =", content);
    const result = this.math(content);
    debug5("callUserFunction =", result);
    return result;
  };
  /**
   * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callBuiltInFunction = (name, args) => {
    debug5("callBuiltInFunction", { name, args });
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
        if (args.length !== 1) throw new Error(`${name} expects exactly 1 numeric argument.`);
        if (name === "arcsin") name = "asin";
        if (name === "arccos") name = "acos";
        if (name === "arctan") name = "atan";
        const val = this.numArg(name, args[0]);
        const mapping = {
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
        const result = mapping[name](val);
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
        if (args.length !== 2) throw new Error("greaterequal() expects exactly 2 numeric arguments.");
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
        if (args.length !== 2) throw new Error("stringsequal() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1 === str2 ? 1 : 0;
      }
      case "stringsequalnocase": {
        if (args.length !== 2) throw new Error("stringsequalnocase() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1.toLowerCase() === str2.toLowerCase() ? 1 : 0;
      }
      // --- SNES/PC Address Conversion ---
      case "snestopc":
      case "pctosnes": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.numArg(name, args[0]);
        return name === "snestopc" ? this.getHost().convertSnesToPc(value) : this.getHost().convertPcToSnes(value);
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
        if (args.length !== 3) throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const num = this.numArg(name, args[2]);
        return this.getHost().canReadFile(filename, pos, num);
      }
      // --- ROM Can-Read functions ---
      case "canread1":
      case "canread2":
      case "canread3":
      case "canread4": {
        if (args.length !== 1) throw new Error(`${name} expects exactly 1 numeric argument.`);
        const pos = this.numArg(name, args[0]);
        const size = parseInt(name.slice(-1), 10);
        return this.getHost().canReadRom(pos, size);
      }
      case "canread": {
        if (args.length !== 2) throw new Error("canread expects exactly 2 numeric arguments (pos, num).");
        const pos = this.numArg(name, args[0]);
        const num = this.numArg(name, args[1]);
        return this.getHost().canReadRom(pos, num);
      }
      // --- ROM Reading functions ---
      case "read1":
      case "read2":
      case "read3":
      case "read4": {
        if (args.length < 1 || args.length > 2)
          throw new Error(`${name} expects 1 or 2 numeric arguments.`);
        const pos = this.numArg(name, args[0]);
        const size = parseInt(name.slice(-1), 10);
        if (args.length === 1) {
          return this.getHost().readRom(pos, size);
        } else {
          const defVal = this.numArg(name, args[1]);
          return this.getHost().readRom(pos, size, defVal);
        }
      }
      // --- File Reading functions ---
      case "readfile1":
      case "readfile2":
      case "readfile3":
      case "readfile4": {
        if (args.length < 2 || args.length > 3) throw new Error(`${name} expects 2 or 3 arguments (filename, pos, [default]).`);
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
      throw new Error(`Function '${funcName}' expected a numeric argument but got a string: ${arg}`);
    }
    return arg;
  };
  strArg = (funcName, arg) => {
    if (typeof arg === "number") {
      throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
    }
    return arg;
  };
  parseFunctionDefinition = () => {
    debug5("parseFunctionDefinition", this.str);
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
    debug5("parseFunctionDefinition =", { args: params, content });
  };
  getHost() {
    if (!this.host) {
      throw new Error("ExpressionHost not set.");
    }
    return this.host;
  }
};

// src/operand-syntax.ts
function parseOperandSyntax(operand) {
  const raw = operand;
  const trimmed = operand.trim();
  const normalizedUpper = trimmed.toUpperCase();
  const indexMatch = trimmed.match(/,\s*([sxy])$/i);
  const indexRegister = indexMatch ? indexMatch[1].toLowerCase() : void 0;
  return {
    raw,
    trimmed,
    normalizedUpper,
    immediate: trimmed.startsWith("#"),
    indirect: trimmed.startsWith("(") || trimmed.startsWith("["),
    indexRegister
  };
}

// src/operand-classifiers.ts
function classifyGenericOperand(input) {
  const { raw, expanded, length } = input;
  const syntax = parseOperandSyntax(raw);
  const lowered = expanded.toLowerCase();
  const normalizedExpanded = expanded.trim();
  const normalizedUpper = normalizedExpanded.toUpperCase();
  const explicitDirectPage = /^\$[\da-f]{1,2}$/i.test(raw);
  const explicitDirectPageIndexedX = /^\$[\da-f]{1,2},x$/i.test(raw);
  let mode = "unknown";
  let baseExpression = expanded;
  let registerName;
  const registerOperandMatch = normalizedUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/);
  const registerIndirectMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)$/);
  const registerIndirectAutoIncrementMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)\+$/);
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
    mode = "absoluteLongIndexedX";
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*x$/i.test(expanded)) {
    mode = "absoluteIndexedX";
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
  } else if (mode === "unknown" && /^\$[\da-f]{6}$/i.test(expanded)) {
    mode = "absoluteLong";
    baseExpression = expanded;
  } else if (mode === "unknown" && /^\$[\da-f]{4}$/i.test(expanded)) {
    mode = "absolute";
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
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
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

// src/operand-resolver.ts
var debug6 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug6 = d("OperandResolver");
} catch {
}
var OperandResolver = class {
  constructor(deps) {
    this.deps = deps;
  }
  normalizeNumericBaseMember(operand) {
    const match = operand.trim().match(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i);
    if (!match) {
      return operand;
    }
    const [, immediatePrefix, literal, indexSuffix = ""] = match;
    return `${immediatePrefix}${literal}${indexSuffix}`;
  }
  splitMathOperandSuffix(operand) {
    const trimmed = operand.trim();
    const indexedMatch = trimmed.match(/^(.+?)(\s*,\s*[sxy])$/i);
    if (!indexedMatch || trimmed.startsWith("(") || trimmed.startsWith("[")) {
      return { expression: trimmed, suffix: "" };
    }
    return {
      expression: indexedMatch[1].trim(),
      suffix: indexedMatch[2]
    };
  }
  isNumericToken(token) {
    return /^-?\d+$/.test(token) || /^\$[\dA-Fa-f]+$/.test(token) || /^%[01]+$/.test(token);
  }
  isSameBankAddress(expanded) {
    const match = expanded.trim().match(/^\$([\da-f]{5,6})(?:\s*,\s*[xy])?$/i);
    if (!match) {
      return false;
    }
    const value = parseInt(match[1], 16);
    const currentBank = this.deps.getCurrentAddress() >>> 16 & 255;
    const targetBank = value >>> 16 & 255;
    return currentBank === targetBank;
  }
  resolveArithmeticToken(token) {
    if (this.isNumericToken(token)) {
      return this.getnum(token);
    }
    if (token.includes(".")) {
      try {
        const structValue = this.deps.resolveStructLabel(token);
        if (typeof structValue === "number" && !Number.isNaN(structValue)) {
          return structValue;
        }
      } catch {
      }
      return this.deps.resolveLabel(token, false);
    }
    return this.deps.resolveLabel(token, false);
  }
  tryResolveSimpleArithmetic(operand) {
    const tokenPattern = "([.A-Z_a-z][\\w.]*|-?\\d+|\\$[\\dA-Fa-f]+|%[01]+)";
    const match = operand.match(new RegExp(`^${tokenPattern}\\s*(<<|>>|[+\\-])\\s*${tokenPattern}$`));
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
  determineValueLength(value, forceTwoBytes) {
    debug6("determineValueLength", value, forceTwoBytes);
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid value type for length determination: ${typeof value}`);
    }
    if (Number.isNaN(value)) {
      throw new Error(`Invalid value for length determination: ${value}`);
    }
    if (typeof value === "string" && value.trim() === "") {
      return 1;
    }
    if (forceTwoBytes) {
      return 2;
    }
    const hexString = typeof value === "number" ? value.toString(16).toUpperCase() : value.startsWith("$") ? value.substring(1) : value;
    if (hexString.length <= 2) {
      return 1;
    }
    if (hexString.length <= 4) {
      return 2;
    }
    return 3;
  }
  isMathExpression(expression) {
    if (!expression || typeof expression !== "string") {
      return false;
    }
    if (/^[A-Z_a-z]\w*\s*\(/.test(expression.trim())) {
      return true;
    }
    return expression.includes("+") || expression.includes("-") || expression.includes("*") || expression.includes("/") || expression.includes("&") || expression.includes("|") || expression.includes("^") || expression.includes("<<") || expression.includes(">>");
  }
  tryResolveLabelInOperand(operand) {
    debug6("tryResolveLabelInOperand", operand);
    if (operand.startsWith("#")) {
      const inner = operand.substring(1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.deps.resolveLabel(inner, false);
          if (labelValue !== 0 || this.deps.hasLabel(inner)) {
            return "#$" + labelValue.toString(16).toUpperCase();
          }
        } catch (error) {
          debug6("label resolution failed for immediate", inner, error);
        }
      }
      return operand;
    }
    if (operand.startsWith("[") && operand.endsWith("]")) {
      const inner = operand.substring(1, operand.length - 1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.deps.resolveLabel(inner, false);
          if (labelValue !== 0 || this.deps.hasLabel(inner)) {
            return "[$" + labelValue.toString(16).toUpperCase() + "]";
          }
        } catch (error) {
          debug6("label resolution failed for indirect", inner, error);
        }
      }
      return operand;
    }
    if (operand.includes(",")) {
      const lastCommaIndex = operand.lastIndexOf(",");
      const basePart = operand.substring(0, lastCommaIndex).trim();
      const indexPart = operand.substring(lastCommaIndex).trim();
      if (!basePart.match(/^[\d$%(]/)) {
        try {
          const labelValue = this.deps.resolveLabel(basePart, false);
          if (labelValue !== 0 || this.deps.hasLabel(basePart)) {
            return "$" + labelValue.toString(16).toUpperCase() + indexPart;
          }
        } catch (error) {
          debug6("label resolution failed for indexed", basePart, error);
        }
      }
      return operand;
    }
    if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
      try {
        const labelValue = this.deps.resolveLabel(operand, false);
        if (labelValue !== 0 || this.deps.hasLabel(operand)) {
          return "$" + labelValue.toString(16).toUpperCase();
        }
      } catch (error) {
        debug6("label resolution failed for direct", operand, error);
      }
    }
    return operand;
  }
  getnum(operand) {
    debug6("getnum", operand);
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
          debug6("function expression deferred until final pass", { operand, error });
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
        try {
          return this.deps.resolveStructLabel(operand);
        } catch {
          if (!this.isMathExpression(operand)) {
            return this.deps.resolveLabel(operand, false);
          }
        }
      }
      if (/^\w+$/.test(operand)) {
        try {
          return this.deps.resolveStructLabel(operand);
        } catch {
        }
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
        debug6("expression deferred until final pass", { operand, error: errorMessage });
        return 0;
      }
      throw error;
    }
  }
  getnumFromNode(operand) {
    if (isReferenceExpressionNode(operand)) {
      if (operand.type === "defineReference") {
        return this.getnum(this.deps.resolveDefines(renderExpressionNode(operand)));
      }
      return this.resolveReferenceValue(this.renderReference(operand));
    }
    switch (operand.type) {
      case "range":
        throw new Error(`Range expression is not a numeric operand: ${renderExpressionNode(operand)}`);
      default:
        try {
          return this.deps.evaluateMath(operand);
        } catch (error) {
          if (this.deps.shouldDeferExpressionEvaluation()) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            debug6("expression node deferred until final pass", { operand, error: errorMessage });
            return 0;
          }
          throw error;
        }
    }
  }
  resolveReferenceValue(reference) {
    if (reference.indexOf(".") !== -1 || reference.indexOf("[") !== -1) {
      try {
        return this.deps.resolveStructLabel(reference);
      } catch {
        if (!this.isMathExpression(reference)) {
          return this.deps.resolveLabel(reference, false);
        }
      }
    }
    if (/^\w+$/.test(reference)) {
      return this.deps.resolveLabel(reference, false);
    }
    return this.getnum(reference);
  }
  renderReference(expression) {
    return renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.getnum(node).toString()
    });
  }
  expandOperand(operand) {
    debug6("expandOperand", operand);
    if (!operand) {
      return { expanded: "", length: 2 };
    }
    let expanded = operand.trim();
    let expectedLength = 2;
    let forceTwoBytes = false;
    if (/^\++$/.test(expanded) || /^-+$/.test(expanded) || expanded === "?+" || expanded === "?-") {
      return { expanded, length: 2 };
    }
    try {
      expanded = this.deps.resolveDefines(expanded);
    } catch (error) {
      debug6("expandOperand not a define", error);
    }
    try {
      expanded = `$${this.deps.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
    } catch (error) {
      debug6("expandOperand not a struct label", error);
    }
    expanded = this.normalizeNumericBaseMember(expanded);
    if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
      forceTwoBytes = true;
    }
    expanded = this.tryResolveLabelInOperand(expanded);
    if (expanded.startsWith("#")) {
      const inner = expanded.substring(1).trim();
      if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
        forceTwoBytes = true;
      }
      if (this.isMathExpression(inner)) {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value, forceTwoBytes);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug6("failed to evaluate immediate expression", inner, error);
        }
      } else if (inner.startsWith("$")) {
        expectedLength = this.determineValueLength(inner.substring(1), forceTwoBytes);
      } else {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value, forceTwoBytes);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug6("failed to evaluate immediate expression", inner, error);
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
    const isRelativeLabelPlaceholder = /^\++$/.test(expanded) || /^-+$/.test(expanded);
    if (!isRelativeLabelPlaceholder && this.isMathExpression(expanded)) {
      try {
        const { expression, suffix } = this.splitMathOperandSuffix(expanded);
        const resolvedValue = this.deps.resolveDefines(expression);
        const result = this.deps.evaluateMath(resolvedValue);
        if (!Number.isNaN(result)) {
          expanded = "$" + result.toString(16).toUpperCase() + suffix;
          expectedLength = this.determineValueLength(result, forceTwoBytes);
        }
      } catch (error) {
        debug6("math evaluation skipped for expression", expanded, error);
      }
    }
    if (forceTwoBytes) {
      expectedLength = 2;
    }
    if (expectedLength === 3 && this.isSameBankAddress(expanded)) {
      expectedLength = 2;
    }
    return { expanded, length: expectedLength };
  }
  lowerOperand(operand) {
    const raw = operand.trim();
    const { expanded, length } = this.expandOperand(raw);
    return classifyGenericOperand({ raw, expanded, length });
  }
};

// src/architecture-registry.ts
var ArchitectureRegistry = class {
  definitions = /* @__PURE__ */ new Map();
  aliases = /* @__PURE__ */ new Map();
  register(definition, aliases = []) {
    this.definitions.set(definition.name, definition);
    this.aliases.set(definition.name, definition.name);
    for (const alias of aliases) {
      this.aliases.set(alias, definition.name);
    }
  }
  getCanonicalName(name) {
    return this.aliases.get(name.toLowerCase());
  }
  getDefinition(name) {
    const canonical = this.getCanonicalName(name);
    if (!canonical) {
      return void 0;
    }
    return this.definitions.get(canonical);
  }
};
var createArchitectureRegistry = (encoder65816, encoderSpc700, encoderSuperFx) => {
  const registry = new ArchitectureRegistry();
  registry.register(
    {
      name: "65816",
      encoder: encoder65816,
      classifyOperand: classify65816Operand
    },
    ["65816"]
  );
  registry.register(
    {
      name: "spc700",
      encoder: encoderSpc700,
      classifyOperand: classifySpc700Operand
    },
    ["spc700", "spc700-raw", "spc700-inline"]
  );
  registry.register(
    {
      name: "superfx",
      encoder: encoderSuperFx,
      classifyOperand: classifySuperFxOperand
    },
    ["superfx"]
  );
  return registry;
};

// src/directives/data.ts
var handleDataDirective = ({ session }, words) => {
  session.handleDataDirective(words[0], words.slice(1));
};
var registerDataDirectives = (registry) => {
  registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], handleDataDirective);
};

// src/directives/fill-pad.ts
var getDirectiveWidth = (keyword, prefix) => {
  if (keyword === `${prefix}byte`) return 1;
  if (keyword === `${prefix}word`) return 2;
  if (keyword === `${prefix}long`) return 3;
  if (keyword === "paddword" || keyword === "filldword") return 4;
  throw new Error(`Unrecognized ${prefix} directive.`);
};
var registerFillPadDirectives = (registry) => {
  registry.register(["fillbyte", "fillword", "filllong", "filldword"], ({ session, operandResolver }, words) => {
    const keyword = words[0];
    const len = getDirectiveWidth(keyword, "fill");
    if (words.length !== 2) {
      throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
    }
    const value = operandResolver.getnum(session.resolvedefines(words[1]));
    for (let i = 0; i < 12; i += len) {
      let current = value;
      for (let j = 0; j < len; j++) {
        session.fillbyte[i + j] = current & 255;
        current >>>= 8;
      }
    }
  });
  registry.register("fill", ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
    }
    const count = operandResolver.getnum(session.resolvedefines(words[1]));
    for (let i = 0; i < count; i++) {
      session.write1(session.fillbyte[i % 12]);
    }
  });
  registry.register(["padbyte", "padword", "padlong", "paddword"], ({ session, operandResolver }, words) => {
    const keyword = words[0];
    const len = getDirectiveWidth(keyword, "pad");
    if (words.length !== 2) {
      throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
    }
    const value = operandResolver.getnum(session.resolvedefines(words[1]));
    session.padUnit = len;
    for (let i = 0; i < len; i++) {
      session.padbyte[i] = value >> 8 * i & 255;
    }
  });
  registry.register("pad", ({ session, operandResolver }, words) => {
    let gap;
    if (words.length === 1) {
      const currentBank = session.currentTargetAddress & 16711680;
      const bankOffset = session.currentTargetAddress & 65535;
      const nextBank = bankOffset === 65535 ? currentBank + 65536 : currentBank + 65536 - bankOffset;
      gap = nextBank;
    } else if (words.length === 2) {
      const targetSNES = operandResolver.getnum(words[1]);
      const targetPC = session.romWriter.convertTargetAddressToRomOffset(targetSNES);
      if (targetPC < 0) {
        throw new Error(`Target SNES address ${targetSNES.toString(16)} does not map to ROM.`);
      }
      const currentPC = session.romWriter.convertTargetAddressToRomOffset(session.currentTargetAddress);
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
  });
};

// src/directives/flow-control.ts
var registerFlowControlDirectives = (registry) => {
  registry.register(["+", "-"], ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
  });
};

// src/directives/include-source.ts
var handleIncbin = ({ session }, words) => {
  let targetLocationSpecified = false;
  let targetLocation = null;
  const arrowIndex = words.indexOf("->");
  const sourceWords = arrowIndex === -1 ? words.slice(1) : words.slice(1, arrowIndex);
  if (arrowIndex !== -1) {
    targetLocationSpecified = true;
    if (arrowIndex + 1 >= words.length) {
      throw new Error("incbin '->' syntax requires a target location.");
    }
    targetLocation = words[arrowIndex + 1];
    words = words.slice(0, arrowIndex);
  }
  const filenameWithRange = sourceWords.join(" ");
  let filename;
  let rangeStr = null;
  const colonIndex = filenameWithRange.indexOf(":");
  if (colonIndex !== -1) {
    filename = filenameWithRange.substring(0, colonIndex);
    rangeStr = filenameWithRange.substring(colonIndex + 1);
  } else {
    filename = filenameWithRange;
  }
  filename = filename.replace(/^"(.*)"$/, "$1");
  const fileData = session.readFile(filename);
  if (!fileData) {
    throw new Error(`Failed to read file: ${filename}`);
  }
  let startOffset = 0;
  let endOffset = fileData.length;
  if (rangeStr) {
    if (rangeStr.indexOf("..") !== -1) {
      const parts = rangeStr.split("..");
      if (parts[0] === "" || parts[1] === "") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      const rangeNode = parseExpressionNode(rangeStr);
      if (rangeNode.type !== "range") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = session.evaluateRangeExpression(rangeNode.start);
      endOffset = session.evaluateRangeExpression(rangeNode.end);
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    } else if (rangeStr.indexOf("-") !== -1) {
      if (rangeStr.includes("(") || rangeStr.includes(")")) {
        throw new Error("Emismatched_parentheses: Mismatched parentheses.");
      }
      const parts = rangeStr.split("-");
      if (parts[0] === "" || parts[1] === "") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = session.evaluateRangeExpression(parts[0]);
      endOffset = session.evaluateRangeExpression(parts[1]);
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    } else {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
  }
  if (startOffset > endOffset || startOffset < 0 || startOffset > fileData.length) {
    throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
  }
  if (endOffset < startOffset || endOffset > fileData.length) {
    throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
  }
  const incbinData = fileData.slice(startOffset, endOffset);
  if (targetLocationSpecified) {
    session.handlePushPC();
    let targetAddress;
    if (/^\$?[\dA-Fa-f]+$/.test(targetLocation ?? "")) {
      targetAddress = session.operandResolver.getnum(targetLocation ?? "");
    } else {
      targetAddress = session.symbolScope.getLabelValue(targetLocation ?? "", false);
    }
    session.setWritePosition(targetAddress);
    for (const byte of incbinData) {
      session.write1(byte);
    }
    session.handlePullPC();
  } else {
    for (const byte of incbinData) {
      session.write1(byte);
    }
  }
  session.recordCurrentAddress();
};
var registerIncludeSourceDirectives = (registry) => {
  registry.register("incsrc", ({ session }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("incsrc requires exactly one filename parameter");
    }
    session.assemblefile(target, false);
  });
  registry.register("include", ({ session }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("include requires exactly one filename parameter");
    }
    session.handleInclude("include", target, false);
  });
  registry.register("includeonce", ({ session }) => {
    const fileInfo = session.includedFiles.get(session.currentFile) || { included: true, guarded: false };
    fileInfo.guarded = true;
    session.includedFiles.set(session.currentFile, fileInfo);
  });
  registry.register("incbin", handleIncbin);
};

// src/directives/layout.ts
var assertMapperAvailable = (inSpcblock) => {
  if (inSpcblock) {
    throw new Error("Mapper directives are unavailable inside spcblock.");
  }
};
var handlePushBase = ({ session }) => {
  session.pushBaseStack.push(session.currentTargetAddress);
};
var handlePullBase = ({ session }) => {
  if (session.pushBaseStack.length === 0) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = session.pushBaseStack.pop();
};
var handleArch = ({ session }, words) => {
  if (session.inSpcblock) {
    throw new Error("ARCH is unavailable inside spcblock.");
  }
  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.");
  }
  const archParam = words[1].toLowerCase();
  const canonical = session.architectureRegistry.getCanonicalName(archParam);
  if (!canonical) {
    throw new Error("Unsupported architecture: " + archParam);
  }
  session.arch = canonical;
  session.spcInlineCompatMode = archParam === "spc700-inline";
};
var handleStartpos = ({ session }, words) => {
  const params = words.slice(1);
  if (!session.inSpcblock || !session.spcblockData) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (params.length !== 1) {
    throw new Error("startpos requires exactly one parameter.");
  }
  session.spcblockData.executeAddress = session.operandResolver.getnum(session.resolvedefines(params[0])) & 65535;
};
var registerLayoutDirectives = (registry) => {
  registry.register("base", ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("BASE directive requires exactly one parameter.");
    }
    const param = words[1].toLowerCase();
    if (param === "off") {
      const baseAddress = Number(session.currentTargetBaseAddress);
      const baseStartAddress = Number(session.currentTargetBaseStartAddress);
      session.currentTargetAddress = baseAddress;
      session.currentTargetStartAddress = baseStartAddress;
      return;
    }
    const value = operandResolver.getnum(param);
    if (value > 16777215) {
      throw new Error(`Invalid base address: ${param}. Must be within 24 bits.`);
    }
    session.currentTargetAddress = value;
    session.currentTargetStartAddress = value;
  });
  registry.register("fastrom", () => {
  });
  registry.register("lorom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "lorom";
  });
  registry.register("hirom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "hirom";
  });
  registry.register("exlorom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "exlorom";
  });
  registry.register("exhirom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "exhirom";
  });
  registry.register("sfxrom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "sfxrom";
  });
  registry.register("norom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "norom";
    session.checksumFixEnabled = false;
  });
  registry.register("fullsa1rom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "bigsa1rom";
  });
  registry.register("sa1rom", ({ session }, words) => {
    assertMapperAvailable(session.inSpcblock);
    if (words.length > 1) {
      const parts = words[1].split(",");
      if (parts.length !== 4) {
        throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
      }
      session.sa1banks = [];
      session.sa1banks[0] = parseInt(parts[0], 10) << 20;
      session.sa1banks[1] = parseInt(parts[1], 10) << 20;
      session.sa1banks[4] = parseInt(parts[2], 10) << 20;
      session.sa1banks[5] = parseInt(parts[3], 10) << 20;
    } else {
      session.sa1banks = [];
      session.sa1banks[0] = 0 << 20;
      session.sa1banks[1] = 1 << 20;
      session.sa1banks[4] = 2 << 20;
      session.sa1banks[5] = 3 << 20;
    }
    session.mapper = "sa1rom";
  });
  registry.register("org", ({ session }, words) => {
    if (session.inSpcblock) {
      throw new Error("ORG is unavailable inside spcblock.");
    }
    if (shouldRedirectOrgToSpcblock(session.spcInlineCompatMode)) {
      session.handleSpcblock(["spcblock", ...words.slice(1)]);
      return;
    }
    session.handleOrg(words.slice(1));
  });
  registry.register("pushbase", handlePushBase);
  registry.register("pullbase", handlePullBase);
  registry.register("pushpc", ({ session }) => {
    session.handlePushPC();
  });
  registry.register("pullpc", ({ session }) => {
    session.handlePullPC();
  });
  registry.register("arch", handleArch);
  registry.register("startpos", handleStartpos);
  registry.register("check", ({ session }, words) => {
    if (words.length >= 2 && words[1].toLowerCase() === "title") {
      session.readFunctionsEnabled = true;
      return;
    }
    if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
      throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
    }
    const mode = words[2].toLowerCase();
    if (mode === "off") {
      session.bankCrossCheckMode = "off";
    } else if (mode === "half") {
      session.bankCrossCheckMode = "half";
    } else if (mode === "full" || mode === "on") {
      session.bankCrossCheckMode = "full";
    } else {
      throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
    }
  });
  registry.register("optimize", ({ session }, words) => {
    if (words.length >= 3 && words[1].toLowerCase() === "dp") {
      const mode = words[2].toLowerCase();
      if (mode === "none") {
        session.optimizeDirectPage = false;
      } else if (mode === "ram" || mode === "always") {
        session.optimizeDirectPage = true;
      }
    }
  });
};

// src/directives/memory.ts
var handleFreespace = ({ session }, words) => {
  if (session.inSpcblock) {
    throw new Error(`${words[0]} is unavailable inside spcblock.`);
  }
  if (session.mapper === "norom") {
    throw new Error("No freespace available in norom.");
  }
  const sourceLen = session.targetRom && session.targetRom.length > 0 ? session.targetRom.length : session.romdata.length;
  const startPc = Math.max(524288, sourceLen);
  if (session.romdata.length < 1048576) {
    session.expandRom(1048576, session.defaultFreespaceByte);
  }
  const startSnes = session.romWriter.pctosnes(startPc);
  if (startSnes < 0) {
    throw new Error("Unable to map freespace start to SNES address.");
  }
  session.currentTargetAddress = startSnes;
  session.currentTargetBaseAddress = startSnes;
  session.currentTargetStartAddress = startSnes;
  session.currentTargetBaseStartAddress = startSnes;
  session.activeFreespaceStartPc = startPc;
  session.write1(83);
  session.write1(84);
  session.write1(65);
  session.write1(82);
  session.write1(0);
  session.write1(0);
  session.write1(255);
  session.write1(255);
  session.activeFreespaceContentStartPc = startPc + 8;
};
var handleFreespaceByte = ({ session }, words) => {
  const params = words.slice(1);
  if (params.length !== 1) {
    throw new Error("FREESPACEBYTE requires exactly one parameter.");
  }
  const value = session.resolvedefines(params[0]);
  session.defaultFreespaceByte = session.operandResolver.getnum(value) & 255;
};
var handleProt = ({ session }, words) => {
  const labelList = words.slice(1);
  if (labelList.length === 0) {
    throw new Error("PROT command requires at least one label parameter.");
  }
  const labels = labelList.join(" ").split(",").map((label) => label.trim()).filter(Boolean);
  if (labels.length === 0) {
    throw new Error("PROT command requires at least one valid label.");
  }
  session.write1(80);
  session.write1(82);
  session.write1(79);
  session.write1(84);
  session.write1(labels.length * 3 & 255);
  for (const label of labels) {
    let address = 0;
    try {
      address = session.symbolScope.getLabelValue(label, false) & 16777215;
    } catch (_error) {
      address = 0;
    }
    session.write3(address);
  }
  session.write1(83);
  session.write1(84);
  session.write1(79);
  session.write1(80);
  session.write1(0);
};
var registerMemoryDirectives = (registry) => {
  registry.register(["freecode", "freespace", "freedata"], handleFreespace);
  registry.register("freespacebyte", handleFreespaceByte);
  registry.register("prot", handleProt);
};

// src/directives/misc.ts
var handlePullTable = ({ session }) => {
  if (session.tableStack.length === 0) {
    throw new Error("pulltable without pushtable");
  }
  session.characterMappings = session.tableStack.pop();
};
var handlePushTable = ({ session }) => {
  session.tableStack.push(new Map(session.characterMappings));
};
var registerMiscDirectives = (registry) => {
  registry.register("pulltable", handlePullTable);
  registry.register("pushtable", handlePushTable);
  registry.register([...ASAR_COMPAT_NO_OP_DIRECTIVES], () => {
  });
};

// src/directives/namespace.ts
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
  if (session.inSpcblock) {
    throw new Error("NAMESPACE is unavailable inside spcblock.");
  }
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
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.push(params[0]);
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = params[0];
    }
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
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.push(params[0]);
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = params[0];
    }
  }
};
var registerNamespaceDirectives = (registry) => {
  registry.register("namespace", handleNamespace);
  registry.register("pushns", handlePushNamespace);
  registry.register("pullns", handlePullNamespace);
};

// src/directives/spc.ts
var handleSpcblock = ({ session }, words) => {
  session.handleSpcblock(words);
};
var handleEndSpcblock = ({ session }, words) => {
  session.handleEndSpcblock(words);
};
var registerSpcDirectives = (registry) => {
  registry.register("spcblock", handleSpcblock);
  registry.register("endspcblock", handleEndSpcblock);
};

// src/directives/struct-binary.ts
var registerStructBinaryDirectives = (registry) => {
  registry.register("struct", ({ session }, words) => {
    session.structEngine.handleStruct(words);
  });
  registry.register("endstruct", ({ session }, words) => {
    session.structEngine.handleEndStruct(words);
  });
};

// src/directives/registry.ts
var DirectiveRegistry = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  handlers = /* @__PURE__ */ new Map();
  register(keyword, handler) {
    const keywords = Array.isArray(keyword) ? keyword : [keyword];
    for (const entry of keywords) {
      this.handlers.set(entry, handler);
    }
  }
  has(keyword) {
    return this.handlers.has(keyword);
  }
  dispatch(keyword, words, raw, command) {
    const handler = this.handlers.get(keyword);
    if (!handler) {
      return false;
    }
    handler(this.ctx, words, raw, command);
    return true;
  }
  dispatchCommand(command) {
    return this.dispatch(command.keyword, command.words, command.command, command);
  }
};
var createDirectiveRegistry = (session, operandResolver) => {
  const registry = new DirectiveRegistry({ session, operandResolver });
  registerIncludeSourceDirectives(registry);
  registerFillPadDirectives(registry);
  registerFlowControlDirectives(registry);
  registerNamespaceDirectives(registry);
  registerLayoutDirectives(registry);
  registerDataDirectives(registry);
  registerSpcDirectives(registry);
  registerStructBinaryDirectives(registry);
  registerMiscDirectives(registry);
  registerMemoryDirectives(registry);
  return registry;
};

// src/services/define-engine.ts
var DefineEngine = class {
  constructor(host) {
    this.host = host;
  }
  isPureMathExpression(value) {
    return /^\s*(?:\$[\dA-Fa-f]+|%[01]+|\d+|[&()*+/<>^|\-]|\s)+$/.test(value);
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
    let index2 = 0;
    let foundDefine = false;
    while (index2 < content.length) {
      if (content.substring(index2).startsWith("!") && index2 + 1 < content.length && /\w/.test(content[index2 + 1])) {
        index2++;
        let defineName = "";
        while (index2 < content.length && /\w/.test(content[index2])) {
          defineName += content[index2++];
        }
        if (this.host.defines.has(defineName)) {
          result += this.host.defines.get(defineName);
          foundDefine = true;
        } else {
          throw new Error(`Define '${defineName}' not found.`);
        }
      } else {
        result += content[index2++];
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
    let index2 = 0;
    while (index2 < content.length) {
      const char = content[index2];
      if (char === "\\") {
        const next = content[index2 + 1];
        if (next === void 0) {
          result += "\\";
          index2++;
          continue;
        }
        if (next === "!") {
          result += "!";
          index2 += 2;
          while (index2 < content.length && /\w/.test(content[index2])) {
            result += content[index2];
            index2++;
          }
          continue;
        }
        if (next === "\\") {
          result += "\\";
          index2 += 2;
          continue;
        }
        result += next;
        index2 += 2;
        continue;
      }
      if (char === "!" && index2 + 1 < content.length && /\w/.test(content[index2 + 1])) {
        index2++;
        let defineName = "";
        while (index2 < content.length && /\w/.test(content[index2])) {
          defineName += content[index2];
          index2++;
        }
        if (!this.host.defines.has(defineName)) {
          throw new Error(`Define '${defineName}' not found.`);
        }
        result += this.host.defines.get(defineName);
        continue;
      }
      result += char;
      index2++;
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
    let index2 = 0;
    while (index2 < value.length) {
      if (value.substring(index2).startsWith("!{")) {
        let braceContent = "";
        index2 += 2;
        let braceLevel = 1;
        while (index2 < value.length && braceLevel > 0) {
          if (value[index2] === "{") braceLevel++;
          else if (value[index2] === "}") braceLevel--;
          if (braceLevel === 0) break;
          braceContent += value[index2];
          index2++;
        }
        if (braceLevel !== 0) {
          throw new Error(`Mismatched braces in value: ${value}`);
        }
        index2++;
        const resolvedIdentifier = this.processNestedDefines(braceContent);
        result += `!{${resolvedIdentifier}}`;
      } else {
        result += value[index2++];
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
    this.host.recordSymbolDefinition("define", identifier, { value });
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

// src/services/command-text-service.ts
var removeInlineComment = (line) => {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && ch === ";") {
      return line.substring(0, i).trim();
    }
  }
  return line.trim();
};
var preprocessBlockCommands = (block, commandBuffer = "") => {
  const lines = block.split("\n");
  const processedLines = [];
  let nextCommandBuffer = commandBuffer;
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith(";`+")) {
      processedLines.push(line);
      continue;
    }
    line = removeInlineComment(line).trim();
    if (!line) continue;
    if (line.endsWith("\\")) {
      nextCommandBuffer += line.slice(0, -1);
    } else if (line.endsWith(",")) {
      nextCommandBuffer += line;
    } else {
      processedLines.push(nextCommandBuffer + line);
      nextCommandBuffer = "";
    }
  }
  return {
    commands: processedLines,
    commandBuffer: nextCommandBuffer
  };
};
var splitInlineCommands = (commands) => {
  const output = [];
  for (const command of commands) {
    const split = command.split(/\s:\s/).map((entry) => entry.trim()).filter(Boolean);
    if (split.length === 0) {
      continue;
    }
    for (const entry of split) {
      const relativeLabelMatch = entry.match(/^([+-]+:)\s+(.+)$/);
      if (relativeLabelMatch) {
        output.push(relativeLabelMatch[1].trim(), relativeLabelMatch[2].trim());
        continue;
      }
      output.push(entry);
    }
  }
  return output;
};
var splitCommandIntoWords = (command) => {
  const words = [];
  let currentWord = "";
  let inQuotes = false;
  let quoteChar = "";
  for (let i = 0; i < command.trim().length; i++) {
    const char = command.trim()[i];
    if ((char === '"' || char === "'") && (i === 0 || command.trim()[i - 1] !== "\\")) {
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
  let index2 = 0;
  while (input[index2] === ".") {
    index2 += 1;
  }
  if (index2 >= input.length || !isLabelIdentifierStart(input[index2])) {
    return false;
  }
  const consumeIdentifier = () => {
    if (index2 >= input.length || !isLabelIdentifierStart(input[index2])) {
      return false;
    }
    index2 += 1;
    while (index2 < input.length && isLabelIdentifierPart(input[index2])) {
      index2 += 1;
    }
    return true;
  };
  if (!consumeIdentifier()) {
    return false;
  }
  while (index2 < input.length && input[index2] === ".") {
    index2 += 1;
    if (!consumeIdentifier()) {
      return false;
    }
  }
  if (index2 < input.length && input[index2] === "[") {
    index2 += 1;
    const digitStart = index2;
    while (index2 < input.length && input[index2] >= "0" && input[index2] <= "9") {
      index2 += 1;
    }
    if (digitStart === index2 || input[index2] !== "]") {
      return false;
    }
    index2 += 1;
    while (index2 < input.length && input[index2] === ".") {
      index2 += 1;
      if (!consumeIdentifier()) {
        return false;
      }
    }
  }
  return index2 === input.length;
}

// src/services/directive-runtime-service.ts
var DirectiveRuntimeService = class {
  constructor(host) {
    this.host = host;
  }
  /**
   * Handles the `spcblock` directive.
   * @param {string[]} words The directive words.
   */
  handleSpcblock(words) {
    if (words.length < 2) {
      throw new Error("spcblock requires at least a destination address.");
    }
    if (words.length > 4) {
      throw new Error("spcblock has too many arguments.");
    }
    if (this.host.inSpcblock) {
      throw new Error("Nested spcblock directives are not supported.");
    }
    const destination = this.host.operandResolver.getnum(this.host.resolvedefines(words[1]));
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
      const kind = words[2].toLowerCase();
      if (kind !== "custom") {
        throw new Error(`Unexpected spcblock argument for type: ${words[2]}`);
      }
      throw new Error("Custom spcblock mode is not implemented.");
    }
    if (type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }
    const sizeAddress = this.host.currentTargetBaseAddress;
    this.host.write2(0);
    this.host.write2(destination);
    this.host.currentTargetAddress = destination;
    this.host.currentTargetStartAddress = destination;
    this.host.spcblockData = {
      destination,
      type,
      sizeAddress,
      executeAddress: null,
      namespaceBackup: this.host.currentNamespace
    };
    this.host.currentNamespace = `:SPCBLOCK:_${this.host.currentNamespace}`;
    this.host.inSpcblock = true;
  }
  /**
   * Handles the `endspcblock` directive.
   * @param {string[]} words The directive words.
   */
  handleEndSpcblock(words) {
    if (!this.host.inSpcblock || !this.host.spcblockData) {
      throw new Error("endspcblock used without an active spcblock.");
    }
    if (this.host.spcblockData.type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }
    if (this.host.canFinalize) {
      const sizePc = this.host.romWriter.convertTargetAddressToRomOffset(this.host.spcblockData.sizeAddress & 16777215);
      if (sizePc < 0) {
        throw new Error("spcblock size address does not map to ROM.");
      }
      const blockSize = this.host.currentTargetAddress - this.host.spcblockData.destination & 65535;
      this.host.writeDataBytes(sizePc, blockSize & 255, 1);
      this.host.writeDataBytes(sizePc + 1, blockSize >> 8 & 255, 1);
    }
    if (words.length === 3) {
      if (words[1].toLowerCase() !== "execute") {
        throw new Error(`Invalid endspcblock argument: ${words[1]}`);
      }
      this.host.write2(0);
      this.host.write2(this.host.operandResolver.getnum(this.host.resolvedefines(words[2])) & 65535);
    } else if (words.length !== 1) {
      throw new Error("Unknown endspcblock format.");
    } else if (this.host.spcblockData.executeAddress !== null) {
      this.host.write2(0);
      this.host.write2(this.host.spcblockData.executeAddress & 65535);
    }
    this.host.currentNamespace = this.host.spcblockData.namespaceBackup;
    this.host.spcblockData = null;
    this.host.inSpcblock = false;
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
    const addr = addressStr.startsWith("$") ? parseInt(addressStr.substring(1), 16) : parseInt(addressStr, 10);
    if (Number.isNaN(addr) || addr < 0 || addr > 16777215) {
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
        const mappedChars = this.host.processStringWithMapping(expandedString);
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
      try {
        const structValue = this.host.structEngine.resolveStructLabel(resolved);
        if (typeof structValue === "number" && !Number.isNaN(structValue)) {
          this.writeDataByLength(len, structValue);
          continue;
        }
        num = structValue;
      } catch {
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
    this.host.addAddressToLine(this.host.currentTargetBaseAddress & 16777215);
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
    this.host.addAddressToLine(this.host.currentTargetBaseAddress & 16777215);
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

// src/services/program-model-builder.ts
var ProgramModelBuilder = class {
  constructor(host) {
    this.host = host;
  }
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
      inMacroDefinition: false
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
  }
  /**
   * Builds a program model from raw source text.
   * @param {string} source The source block to parse.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ProgramModel} The parsed program model.
   */
  buildProgramModel(source, sourceFile = this.host.currentFile, startLine = 0) {
    const commands = splitInlineCommands(this.host.preprocessBlockCommands(source));
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
    const commands = splitInlineCommands(this.host.preprocessBlockCommands(source));
    return {
      type: "include",
      file,
      commands: this.getOrBuildPassProgram(commands, file, 0)
    };
  }
  /**
   * Returns cached executable nodes for a command stream.
   * @param {string[]} commands The command stream.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ExecutableNode[]} The cached or parsed nodes.
   */
  getOrBuildPassProgram(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    const cacheKey = `${sourceFile}::${startLine}::${commands.join("\n")}`;
    const cached = this.host.passProgramCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const nodes = this.parseCommandStreamToNodes(commands, sourceFile, startLine);
    this.host.passProgramCache.set(cacheKey, nodes);
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
   * @param {string[]} commands The command stream.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ExecutableNode[]} The executable nodes.
   */
  parseCommandStreamToNodes(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    const state = this.createIncrementalParseState();
    for (let index2 = 0; index2 < commands.length; index2++) {
      this.consumeCommandIntoState(state, commands[index2], sourceFile, startLine + index2);
    }
    return state.roots;
  }
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
  consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine) {
    const command = this.host.createLoopCommandNode(rawCommand, sourceFile, sourceLine);
    const keyword = command.keyword.toLowerCase();
    if (keyword === "macro") {
      state.inMacroDefinition = true;
      this.pushToCurrent(state, command);
      return;
    }
    if (state.inMacroDefinition) {
      this.pushToCurrent(state, command);
      if (keyword === "endmacro") {
        state.inMacroDefinition = false;
      }
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
  isNodeComplete(node) {
    if ("source" in node) {
      return true;
    }
    return node.endLine !== void 0;
  }
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

// src/services/assembly-front-end-service.ts
var AssemblyFrontEndService = class {
  constructor(host) {
    this.host = host;
    this.programModelBuilder = new ProgramModelBuilder({
      currentFile: this.host.currentFile,
      currentLine: this.host.currentLine,
      passProgramCache: this.host.passProgramCache,
      preprocessBlockCommands: (source) => this.preprocessBlockCommands(source),
      createLoopCommandNode: (command, sourceFile, sourceLine) => this.createLoopCommandNode(command, sourceFile, sourceLine),
      shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.host.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine)
    });
  }
  commandBuffer = "";
  programModelBuilder;
  /**
   * Preprocesses raw source blocks while preserving continued-line buffering.
   * @param {string} block The raw source block.
   * @returns {string[]} The normalized commands.
   */
  preprocessBlockCommands(block) {
    const processed = preprocessBlockCommands(block, this.commandBuffer);
    this.commandBuffer = processed.commandBuffer;
    return processed.commands;
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
    let normalizedCommand = removeInlineComment(command);
    if (this.host.inMacroExpansion && !this.host.isDefinitionCollectionStage && (normalizedCommand.includes("...") || normalizedCommand.includes("\u2026"))) {
      normalizedCommand = this.host.resolveVariadicPlaceholders(normalizedCommand);
    }
    const words = splitCommandIntoWords(normalizedCommand);
    if (!allowEmpty && words.length === 0) {
      return null;
    }
    return createNormalizedCommand(command, normalizedCommand, words, sourceFile, sourceLine);
  }
  /**
   * Creates a loop-aware normalized command node for the typed parser.
   * @param {string} command The raw command text.
   * @param {string} [sourceFile] Optional source file.
   * @param {number} [sourceLine] Optional source line.
   * @returns {NormalizedCommand} The normalized node.
   */
  createLoopCommandNode(command, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
    return this.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, true) ?? createNormalizedCommand(command, "", [], sourceFile, sourceLine);
  }
  createIncrementalParseState() {
    return this.programModelBuilder.createIncrementalParseState();
  }
  resetIncrementalParseState(state) {
    this.programModelBuilder.resetIncrementalParseState(state);
  }
  buildProgramModel(source, sourceFile = this.host.currentFile, startLine = 0) {
    return this.programModelBuilder.buildProgramModel(source, sourceFile, startLine);
  }
  getOrBuildPassProgram(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    return this.programModelBuilder.getOrBuildPassProgram(commands, sourceFile, startLine);
  }
  createIncludeNode(file, source) {
    return this.programModelBuilder.createIncludeNode(file, source);
  }
  consumeIncrementalCommand(state, rawCommand, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
    return this.programModelBuilder.consumeIncrementalCommand(state, rawCommand, sourceFile, sourceLine);
  }
  drainCompletedRoots(state) {
    return this.programModelBuilder.drainCompletedRoots(state);
  }
  parseCommandStreamToNodes(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    return this.programModelBuilder.parseCommandStreamToNodes(commands, sourceFile, startLine);
  }
};

// src/services/command-lowering-service.ts
var DIRECTLY_LOWERABLE_DIRECTIVES = /* @__PURE__ */ new Set([
  "arch",
  "base",
  "check",
  "exhirom",
  "exlorom",
  "fastrom",
  "fill",
  "fillbyte",
  "filldword",
  "filllong",
  "fillword",
  "fullsa1rom",
  "hirom",
  "lorom",
  "namespace",
  "norom",
  "optimize",
  "org",
  "pad",
  "padbyte",
  "paddword",
  "padlong",
  "padword",
  "pullbase",
  "pullns",
  "pullpc",
  "pulltable",
  "pushbase",
  "pushns",
  "pushpc",
  "pushtable",
  "sa1rom",
  "sfxrom",
  "startpos"
]);
var CommandLoweringService = class {
  constructor(host) {
    this.host = host;
  }
  /**
   * Lowers a normalized command into the execution-layer representation.
   * @param {NormalizedCommand} command The normalized command node.
   * @returns {LoweredCommand} The lowered execution work unit.
   */
  lowerCommand(command) {
    const keyword = command.keyword.toLowerCase();
    if (this.host.directiveRegistry.has(keyword)) {
      let directiveWords = command.words;
      if (command.parsed.includeTarget) {
        directiveWords = [command.parsed.includeTarget.directive, command.parsed.includeTarget.target];
      } else if (keyword === "incbin" && command.parsed.directiveArgs?.args?.length) {
        directiveWords = [keyword, ...command.parsed.directiveArgs.args];
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
    const isaLoweredInstruction = architecture.definition?.encoder.lowerInstructionFromCommand?.(command);
    if (isaLoweredInstruction) {
      return isaLoweredInstruction;
    }
    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? [operandText] : []);
    const loweredOperands = operands.map((operand) => this.host.classifyOperandForActiveArchitecture(operand));
    const loweredOperand = this.host.classifyOperandForActiveArchitecture(operandText);
    return {
      kind: "instruction",
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
   * Commands that still need legacy preprocessing are preserved as detached
   * command snapshots so the cached program tree never gets mutated at runtime.
   * @param {ExecutableNode} node The node to lower.
   * @returns {LoweredExecutableNode} The lowered node.
   */
  lowerExecutableNode(node) {
    if ("source" in node) {
      const detached = cloneNormalizedCommand(node);
      if (this.shouldPreserveCommand(detached)) {
        return {
          kind: "command",
          command: detached,
          source: detached.source
        };
      }
      return this.lowerCommand(detached);
    }
    if (node.type === "for" || node.type === "while") {
      return {
        kind: "loop",
        loopType: node.type,
        header: node.header ? cloneNormalizedCommand(node.header) : void 0,
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
      header: conditionalNode.header ? cloneNormalizedCommand(conditionalNode.header) : void 0,
      branches: conditionalNode.branches.map((branch2) => ({
        kind: branch2.kind,
        header: branch2.header ? cloneNormalizedCommand(branch2.header) : void 0,
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
    return {
      sourceFile: program.sourceFile,
      startLine: program.startLine,
      nodes: program.nodes.map((node) => this.lowerExecutableNode(node))
    };
  }
  /**
   * Commands that still require legacy preprocess / control handlers must remain
   * as detached command snapshots rather than direct lowered directives.
   * @param {NormalizedCommand} command The command to inspect.
   * @returns {boolean} True when the command should stay in passthrough form.
   */
  shouldPreserveCommand(command) {
    const keyword = command.keyword.toLowerCase();
    if (/<[^>]+>/.test(command.command)) {
      return true;
    }
    if (command.kind !== "unknown" && command.kind !== "opcodeCandidate") {
      return true;
    }
    if (this.host.directiveRegistry.has(keyword) && DIRECTLY_LOWERABLE_DIRECTIVES.has(keyword)) {
      return false;
    }
    return command.kind !== "opcodeCandidate";
  }
};

// src/services/front-end-command-service.ts
var FrontEndCommandService = class {
  constructor(host) {
    this.host = host;
  }
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
    const isRelativeLabelDefinition = /^\++:?$/.test(keyword) || /^-+:?$/.test(keyword);
    if (!isRelativeLabelDefinition) {
      return false;
    }
    const relativeLabel = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
    this.host.symbolScope.handleRelativeLabel(relativeLabel);
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", relativeLabel, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan
    });
    command.labelName = relativeLabel;
    setCommandKind(command, "labelDefinition");
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
    while (remainingWords.length > 0 && (keyword.endsWith(":") || keyword.startsWith("."))) {
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      this.host.symbolScope.handleLabelDefinition(labelName);
      this.host.recordSymbolDefinition("label", labelName, {
        span: command.source.tokenSpans[consumedCount] ?? command.source.tokenSpans[0] ?? command.source.normalizedSpan
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
    if (words.length !== 3 || words[1] !== "=") {
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
    this.host.symbolScope.setLabel(labelName, value, true);
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", labelName, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
      value
    });
    command.assignmentTarget = labelName;
    setCommandKind(command, "staticAssignment");
    return true;
  }
};

// src/services/macro-engine.ts
var MacroEngine = class {
  constructor(host) {
    this.host = host;
  }
  macroExpansionControlStack = [];
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
    return this.macroExpansionControlStack.some((entry) => entry.active && (entry.type === "for" || entry.type === "while"));
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
            sourceFile: this.host.currentFile
          };
          if (this.host.macros.has(macroDef.name)) {
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }
          this.host.macros.set(macroDef.name, macroDef);
          this.host.recordSymbolDefinition("macro", macroDef.name);
        }
        this.host.inMacroDefinition = false;
        this.host.currentMacroName = "";
        this.host.currentMacroParams = [];
        this.host.currentMacroBody = [];
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
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }
    if (keyword.startsWith("%")) {
      const parsedInvocation = commandNode.parsed.macroInvocation;
      const invocation = parsedInvocation ? parsedInvocation.args.length > 0 ? `${parsedInvocation.name}(${parsedInvocation.args.join(", ")})` : parsedInvocation.name : words.join(" ").substring(1);
      this.callMacro(invocation);
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
      modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+_[\w+.\-]+)(?!:)/g, (match, labelRef) => {
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
      });
      modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+)(?!:)/g, (match, labelRef) => {
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
      });
    }
    return modifiedCommand;
  }
  /**
   * Calls a macro.
   * @param {string} invocation The invocation to call.
   */
  callMacro(invocation) {
    this.host.macroLabelInstance++;
    const previousMacroExpansionState = this.host.inMacroExpansion;
    const previousVariadicCount = this.host.currentVariadicCount;
    const previousVariadicArgs = this.host.currentVariadicArgs;
    const previousMacroName = this.host.currentMacroName;
    const previousParentLabel = this.host.currentParentLabel;
    const previousParentIsGlobal = this.host.currentParentIsGlobal;
    const previousMacroExpansionControlStack = this.macroExpansionControlStack.map((entry) => ({ ...entry }));
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
        const expandedLine = this.expandMacroLine(lineNode.command, fixedArgs, variadicArgs, variadicCount);
        this.processMacroLine(expandedLine);
      }
    } finally {
      this.host.currentMacroName = previousMacroName;
      this.host.currentParentLabel = previousParentLabel;
      this.host.currentParentIsGlobal = previousParentIsGlobal;
      this.host.currentVariadicCount = previousVariadicCount;
      this.host.currentVariadicArgs = previousVariadicArgs;
      this.host.inMacroExpansion = previousMacroExpansionState;
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
    const resolveDeprecatedBangAngle = (match, name) => {
      if (fixedArgs.has(name)) {
        const fixedValue = fixedArgs.get(name);
        return fixedValue !== void 0 ? this.host.resolvedefines(fixedValue) : match;
      }
      if (/^[A-Za-z]$/.test(name)) {
        const index2 = name.toLowerCase().charCodeAt(0) - 97;
        if (index2 >= 0 && index2 < variadicCount) {
          return variadicArgs[index2];
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
            return this.host.resolvedefines(fixedArgs.get(paramName) ?? "");
          }
          return match;
        });
        expandedValue = expandedValue.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match, expr) => {
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
          let index2 = this.host.mathCore.math(resolvedExpr);
          if (Number.isNaN(index2)) {
            throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
          }
          index2 = Math.floor(index2);
          if (index2 < 0 || index2 >= variadicCount) {
            throw new Error(`Variadic index ${index2} out of range (0..${variadicCount - 1}).`);
          }
          return variadicArgs[index2];
        });
        expandedValue = expandedValue.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
        return `!${varName} ${operator} ${expandedValue}`;
      }
    }
    if (line.match(/^\s*[#?][\w+.\-]+:/) || line.match(/^\s*[#?][\w+.\-]+\s*=/)) {
      return line;
    }
    let expanded = line;
    expanded = expanded.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
    expanded = expanded.replace(/<(\w+)>/g, (match, paramName) => {
      if (fixedArgs.has(paramName)) {
        return this.host.resolvedefines(fixedArgs.get(paramName) ?? "");
      }
      return match;
    });
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
      let index2 = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index2)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }
      index2 = Math.floor(index2);
      if (index2 < 0 || index2 >= variadicCount) {
        throw new Error(`Variadic index ${index2} out of range (0..${variadicCount - 1}).`);
      }
      return variadicArgs[index2];
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
      let index2 = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index2)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }
      index2 = Math.floor(index2);
      if (index2 < 0 || index2 >= variadicCount) {
        throw new Error(`Variadic index ${index2} out of range (0..${variadicCount - 1}).`);
      }
      return this.host.currentVariadicArgs[index2];
    });
    return resolved;
  }
  /**
   * Processes a macro line.
   * @param {string} line The line to process.
   */
  processMacroLine(line) {
    const trimmed = removeInlineComment(line).trim();
    const keyword = trimmed.split(/\s+/, 1)[0]?.toLowerCase();
    const isControlDirective = keyword === "if" || keyword === "elseif" || keyword === "else" || keyword === "endif" || keyword === "while" || keyword === "endwhile" || keyword === "for" || keyword === "endfor";
    if (!this.isMacroExpansionActive() && !isControlDirective) {
      return;
    }
    if (/^\s*[#?][\w+.\-]+:/.test(line)) {
      if (line.trim().startsWith("?+:") || line.trim().startsWith("?-:")) {
        const labelChar = line.trim();
        const remainder = line.trim().substring(3).trim();
        this.host.symbolScope.handleRelativeLabel(labelChar);
        if (remainder) {
          this.host.processCommand(remainder);
          this.updateMacroExpansionControlState(remainder);
        }
        return;
      }
      const match = line.match(/^\s*([#?][\w+.\-]+):/);
      if (match) {
        const labelName = match[1];
        const remainder = line.substring(match[0].length).trim();
        this.host.symbolScope.setLabel(labelName, void 0, false, true);
        if (remainder) {
          this.host.processCommand(remainder);
          this.updateMacroExpansionControlState(remainder);
        }
        return;
      }
    }
    if (/^\s*\?[\w+.\-]+ *=/.test(line)) {
      const match = line.match(/^\s*(\?[\w+.\-]+) *=\s*(.*)/);
      if (match) {
        const labelName = match[1];
        const expression = match[2].trim();
        const value = this.host.mathCore.math(expression);
        this.host.symbolScope.setLabel(labelName, value, true, true);
        return;
      }
    }
    this.host.processCommand(line);
    this.updateMacroExpansionControlState(line);
  }
};

// src/services/rom-writer-service.ts
var RomWriterService = class {
  constructor(host) {
    this.host = host;
  }
  /**
   * Steps the SNES position.
   * @param {number} num The number of bytes to step.
   */
  step(num) {
    if (num === 0) {
      return;
    }
    if (num < 0) {
      throw new Error("step num is negative");
    }
    this.host.currentTargetAddress = this.host.currentTargetAddress & 4278190080 | this.fixsnespos(this.host.currentTargetAddress & 16777215, num);
    this.host.currentTargetBaseAddress = this.host.currentTargetBaseAddress & 4278190080 | this.fixsnespos(this.host.currentTargetBaseAddress & 16777215, num);
    this.host.syncWriteStarts();
    this.host.incrementBytesWritten(num);
  }
  /**
   * Writes a single byte at the current position using 65816/ROM addressing.
   * @param {number} num The value to write.
   */
  write1_65816(num) {
    if (Number.isNaN(num)) {
      throw new Error("write1_65816 num is NaN");
    }
    this.verifysnespos();
    const wrappedPos = this.fixsnespos(this.host.currentTargetBaseAddress & 16777215);
    const bankByte = this.host.currentTargetBaseAddress & 4278190080;
    const newPos = bankByte | wrappedPos;
    const pcpos = this.convertTargetAddressToRomOffset(newPos & 16777215);
    this.host.traceWrite?.({
      stage: this.host.traceStage,
      arch: this.host.inSpcblock ? "spc700" : this.host.arch,
      file: "",
      line: 0,
      raw: "",
      normalized: "",
      snesAddress: newPos & 16777215,
      pcAddress: pcpos,
      value: num & 255
    });
    if (this.host.canEmitBytes) {
      if (pcpos >= this.host.romdata.length && pcpos - this.host.romdata.length > 0) {
        this.host.fillRomData(this.host.romdata.length, this.host.defaultFreespaceByte, pcpos - this.host.romdata.length);
      }
      this.host.romdata[pcpos] = num & 255;
    }
    this.step(1);
  }
  /**
   * Writes a single byte to the ROM.
   * @param {number} num The value to write.
   */
  write1(num) {
    this.write1_65816(num);
  }
  /**
   * Writes a 16-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write2(num) {
    this.assertBankCrossAllowed(2);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
  }
  /**
   * Writes a 24-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write3(num) {
    this.assertBankCrossAllowed(3);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
    this.write1(num >> 16 & 255);
  }
  /**
   * Writes a 32-bit value to the ROM.
   * @param {number} num The value to write.
   */
  write4(num) {
    this.assertBankCrossAllowed(4);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
    this.write1(num >> 16 & 255);
    this.write1(num >> 24 & 255);
  }
  /**
   * Asserts that bank cross is allowed.
   * @param {number} length The length of the value to write.
   */
  assertBankCrossAllowed(length) {
    if (this.host.bankCrossCheckMode === "off" || length <= 1) {
      return;
    }
    const start = this.host.currentTargetBaseAddress & 16777215;
    const end = start + length - 1 & 16777215;
    const mask = this.host.bankCrossCheckMode === "half" ? 2147450880 : 2147418112;
    if (((start ^ end) & mask) !== 0) {
      const errorAddr = start + length & 16777215;
      throw new Error(`Ebank_border_crossed: A bank border was crossed, SNES address $${errorAddr.toString(16).toUpperCase().padStart(6, "0")}.`);
    }
  }
  /**
   * Finishes the pass.
   */
  finishPass() {
    if (this.host.spcInlineCompatMode && this.host.inSpcblock) {
      this.host.handleEndSpcblock(["endspcblock", "execute", "0"]);
    }
    if (this.host.inSpcblock) {
      throw new Error("Missing endspcblock before end of pass.");
    }
    if (this.host.canFinalize && this.host.activeFreespaceStartPc !== null && this.host.activeFreespaceContentStartPc !== null) {
      const contentEndPc = this.convertTargetAddressToRomOffset(this.host.currentTargetBaseAddress & 16777215) - 1;
      if (contentEndPc >= this.host.activeFreespaceContentStartPc) {
        const contentLen = contentEndPc - this.host.activeFreespaceContentStartPc + 1;
        const ratsLenMinusOne = Math.max(0, contentLen - 1) & 65535;
        const ratsComp = ~ratsLenMinusOne & 65535;
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 4, ratsLenMinusOne & 255, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 5, ratsLenMinusOne >> 8 & 255, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 6, ratsComp & 255, 1);
        this.host.writeDataBytes(this.host.activeFreespaceStartPc + 7, ratsComp >> 8 & 255, 1);
      }
    }
    if (this.host.canFinalize && this.host.checksumFixEnabled) {
      this.host.updateHeaderAndCRC32();
    }
  }
  /**
   * Converts a SNES address to a PC offset.
   * @param {number} addr The SNES address to convert.
   * @returns {number} The PC offset.
   */
  convertTargetAddressToRomOffset(addr) {
    if (addr < 0 || addr > 16777215) return -1;
    if (this.host.mapper === "lorom") {
      if ((addr & 16646144) === 8257536 || (addr & 4227072) === 0 || (addr & 7372800) === 7340032) {
        return -1;
      }
      return (addr & 8323072) >> 1 | addr & 32767;
    }
    if (this.host.mapper === "hirom") {
      if ((addr & 16646144) === 8257536 || (addr & 4227072) === 0) {
        return -1;
      }
      return addr & 4194303;
    }
    if (this.host.mapper === "exlorom") {
      if ((addr & 15728640) === 7340032 || (addr & 4227072) === 0) {
        return -1;
      }
      if (addr & 8388608) {
        return (addr & 8323072) >> 1 | addr & 32767;
      }
      return ((addr & 8323072) >> 1 | addr & 32767) + 4194304;
    }
    if (this.host.mapper === "exhirom") {
      if ((addr & 16646144) === 8257536 || (addr & 4227072) === 0) {
        return -1;
      }
      return (addr & 8388608) === 0 ? addr & 4194303 | 4194304 : addr & 4194303;
    }
    if (this.host.mapper === "sfxrom") {
      if ((addr & 6291456) === 6291456 || (addr & 4227072) === 0 || (addr & 8388608) === 8388608) {
        return -1;
      }
      return addr & 4194304 ? addr & 4194303 : (addr & 8323072) >> 1 | addr & 32767;
    }
    if (this.host.mapper === "sa1rom") {
      if ((addr & 4227072) === 32768) {
        return this.host.sa1banks[(addr & 14680064) >> 21] | (addr & 2031616) >> 1 | addr & 32767;
      }
      if ((addr & 12582912) === 12582912) {
        return this.host.sa1banks[(addr & 1048576) >> 20 | (addr & 2097152) >> 19] | addr & 1048575;
      }
      return -1;
    }
    if (this.host.mapper === "bigsa1rom") {
      if ((addr & 12582912) === 12582912) {
        return addr & 4194303 | 4194304;
      }
      if ((addr & 12582912) === 0 || (addr & 12582912) === 8388608) {
        if ((addr & 32768) === 0) {
          return -1;
        }
        return (addr & 8388608) >> 2 | (addr & 4128768) >> 1 | addr & 32767;
      }
      return -1;
    }
    if (this.host.mapper === "norom") {
      return addr;
    }
    return -1;
  }
  snestopc(addr) {
    return this.convertTargetAddressToRomOffset(addr);
  }
  /**
   * Converts a PC offset to a SNES address.
   * @param {number} addr The PC offset to convert.
   * @returns {number} The SNES address.
   */
  pctosnes(addr) {
    if (addr < 0) return -1;
    if (this.host.mapper === "lorom") {
      if (addr >= 4194304) return -1;
      addr = addr << 1 & 8323072 | addr & 32767 | 32768;
      return addr | 8388608;
    }
    if (this.host.mapper === "hirom") {
      if (addr >= 4194304) return -1;
      return addr | 12582912;
    }
    if (this.host.mapper === "exlorom") {
      if (addr >= 8388608) return -1;
      if (addr & 4194304) {
        addr -= 4194304;
        addr = addr << 1 & 8323072 | addr & 32767 | 32768;
        return addr;
      }
      addr = addr << 1 & 8323072 | addr & 32767 | 32768;
      return addr | 8388608;
    }
    if (this.host.mapper === "exhirom") {
      if (addr >= 8388608) return -1;
      return addr & 4194304 ? addr : addr | 12582912;
    }
    if (this.host.mapper === "sa1rom") {
      if (addr >= 8388608) return -1;
      for (let i = 0; i < 8; i++) {
        if (this.host.sa1banks[i] === (addr & 7340032)) {
          return 32768 | i << 21 | (addr & 1015808) << 1 | addr & 32767;
        }
      }
      return -1;
    }
    if (this.host.mapper === "bigsa1rom") {
      if (addr >= 8388608) return -1;
      if ((addr & 4194304) === 4194304) {
        return addr | 12582912;
      }
      if ((addr & 6291456) === 0) {
        return addr << 1 & 4128768 | 32768 | addr & 32767;
      }
      if ((addr & 6291456) === 2097152) {
        return 8388608 | addr << 1 & 4128768 | 32768 | addr & 32767;
      }
      return -1;
    }
    if (this.host.mapper === "sfxrom") {
      if (addr >= 2097152) return -1;
      return addr << 1 & 8323072 | addr & 32767 | 32768;
    }
    if (this.host.mapper === "norom") {
      return addr;
    }
    return -1;
  }
  /**
   * Verifies the SNES position.
   */
  verifysnespos() {
    if (this.host.currentTargetAddress < 0 || this.host.currentTargetBaseAddress < 0) {
      this.host.setWritePosition(32768);
    }
  }
  /**
   * Fixes the SNES position.
   * @param {number} inaddr The address to fix.
   * @param {number} step The number of bytes to step.
   * @returns {number} The fixed address.
   */
  fixsnespos(inaddr, step = 0) {
    const newAddr = inaddr + step;
    if ((inaddr & 16711680) !== (newAddr & 16711680)) {
      switch (this.host.mapper) {
        case "lorom":
          return newAddr & 16711680 | (newAddr & 65535) + 32768;
        case "hirom":
        case "exhirom":
        case "sfxrom":
        case "sa1rom":
          if ((inaddr & 4194304) === 0) {
            return newAddr & 16711680 | (newAddr & 65535) + 32768;
          }
          return newAddr;
        case "exlorom":
        case "bigsa1rom":
          return this.pctosnes(this.convertTargetAddressToRomOffset(inaddr) + step);
        case "norom":
          return newAddr;
        default:
          throw new Error(`Unknown mapper type: ${this.host.mapper}`);
      }
    }
    return newAddr;
  }
};

// src/services/struct-engine.ts
var StructEngine = class {
  constructor(host) {
    this.host = host;
  }
  /**
   * Handles a struct mode command.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStructMode(command) {
    if (!this.host.currentStruct) {
      return false;
    }
    const { words } = command;
    const keyword = words[0] ?? "";
    if (keyword.startsWith(".")) {
      const hasColon = keyword.endsWith(":");
      const labelName = keyword.replace(/:$/, "").substring(1);
      this.host.currentStruct.labels.set(labelName, this.host.currentStruct.offset);
      this.host.recordSymbolDefinition("structMember", labelName, {
        value: this.host.currentStruct.offset,
        containerName: this.host.currentStruct.name
      });
      if (words[1]?.toLowerCase() === "skip") {
        if (words.length !== 3) {
          throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
        }
        const skipAmount = this.host.operandResolver.getnum(words[2]);
        this.host.currentStruct.offset += skipAmount;
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
      if (!this.host.structs.has(parent)) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      base = this.host.structs.get(parent).base;
    } else {
      base = this.host.operandResolver.getnum(words[2]);
      if (base < 0 || base > 16777215) {
        throw new Error(`Invalid SNES address for struct: ${words[2]}`);
      }
    }
    this.host.enterStructDefinition(base);
    this.host.currentStruct = {
      name: structName,
      base,
      offset: 0,
      size: 0,
      labels: /* @__PURE__ */ new Map(),
      parent
    };
    this.host.recordSymbolDefinition("struct", structName, { value: base });
  }
  /**
   * Handles an endstruct command.
   * @param {string[]} words The words of the command.
   */
  handleEndStruct(words) {
    if (!this.host.currentStruct) {
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
    let finalSize = this.host.currentStruct.offset;
    if (align !== void 0) {
      finalSize = Math.ceil(finalSize / align) * align;
      this.host.currentStruct.align = align;
    }
    this.host.currentStruct.size = finalSize;
    if (this.host.currentStruct.parent) {
      const parentName = this.host.currentStruct.parent;
      const parentStruct = this.host.structs.get(parentName);
      const extSize = this.host.currentStruct.size;
      if (!parentStruct.extensionSize || extSize > parentStruct.extensionSize) {
        parentStruct.extensionSize = extSize;
      }
      this.host.structs.set(`${parentName}.${this.host.currentStruct.name}`, this.host.currentStruct);
      this.host.structs.set(this.host.currentStruct.name, this.host.currentStruct);
    } else {
      this.host.structs.set(this.host.currentStruct.name, this.host.currentStruct);
    }
    this.host.restoreStructDefinition();
    this.host.currentStruct = null;
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
      if (this.host.structs.has(parentName)) {
        const parentDef = this.host.structs.get(parentName);
        if (this.host.structs.has(labelRef) && this.host.structs.get(labelRef).parent === parentName) {
          return parentDef.base + parentDef.size;
        }
      }
    }
    if (this.host.structs.has(labelRef)) {
      return this.host.structs.get(labelRef).base;
    }
    let arrayIndex = 0;
    let candidate = labelRef;
    let extraMember = "";
    const arrayMatch = candidate.match(/^(.*?)\[(-?\d+)](.*)$/);
    if (arrayMatch) {
      candidate = arrayMatch[1];
      arrayIndex = Number.parseInt(arrayMatch[2], 10);
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
      const memberPart = parts.slice(i).join(".");
      const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");
      const baseStructSize = def.size;
      let effectiveSize = baseStructSize;
      if (def.align) {
        effectiveSize = Math.ceil(baseStructSize / def.align) * def.align;
      }
      let maxExtensionSize = 0;
      for (const [, structDef] of this.host.structs.entries()) {
        if (structDef.parent === potential && structDef.size > maxExtensionSize) {
          maxExtensionSize = structDef.size;
        }
      }
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
      let finalAddress;
      if (def.parent) {
        const parentDef = this.host.structs.get(def.parent);
        if (!parentDef) {
          throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
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

// src/services/symbol-scope-service.ts
var SymbolScopeService = class {
  constructor(host) {
    this.host = host;
  }
  isMissingLabelError(error) {
    return error instanceof Error && error.message.startsWith("Error: Label '");
  }
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
    return this.host.labelTable.has(identifier) || (this.host.currentNamespace ? this.host.labelTable.has(`${this.host.currentNamespace}_${identifier}`) : false);
  }
  /**
   * Handles a relative label.
   * @param {string} label The label to handle.
   * @returns {number} The address of the label.
   */
  handleRelativeLabel(label) {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const snesAddress = this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");
    if (this.host.enforceResolvedLabels) {
      if (isPositive) {
        if (!this.host.forwardLabels[depth] || this.host.forwardLabels[depth].length === 0) {
          throw new Error(`Error: Undefined forward label '${label}'.`);
        }
      } else if (!this.host.backwardLabels[depth] || this.host.backwardLabels[depth].length === 0) {
        throw new Error(`Error: Undefined backward label '${label}'.`);
      }
      return snesAddress;
    }
    if (isPositive) {
      if (!this.host.forwardLabels[depth]) this.host.forwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.forwardLabels[depth].push({ addr: snesAddress, macroInstance: this.host.macroLabelInstance });
      } else {
        this.host.forwardLabels[depth].push({ addr: snesAddress });
      }
    } else {
      if (!this.host.backwardLabels[depth]) this.host.backwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.backwardLabels[depth].push({ addr: snesAddress, macroInstance: this.host.macroLabelInstance });
      } else {
        this.host.backwardLabels[depth].push({ addr: snesAddress });
      }
    }
    return snesAddress;
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
      this.host.recordSymbolDefinition("label", fullLabel, { value: addr });
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
          throw new Error(`Label "${fullLabel}" changed from $${existingEntry.value.toString(16)} to $${addr.toString(16)}`);
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
    this.host.recordSymbolDefinition("label", fullLabel, { value: addr });
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
    if (!firstId || !this.host.structs.has(firstId)) throw new Error(`Struct not found: ${compoundId}`);
    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.host.structs.get(firstId);
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
        const index2 = Number.parseInt(indexStr, 10);
        if (Number.isNaN(index2)) throw new Error(`Invalid struct index: ${indexStr}`);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index2 * currentStruct.size;
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
    if (label.startsWith(".") && this.host.currentParentLabel) {
      let dotCount = 0;
      while (label[dotCount] === ".") {
        dotCount++;
      }
      const localName = label.substring(dotCount);
      const candidates = /* @__PURE__ */ new Set();
      const nestedLocalParts = localName.split("_").filter(Boolean);
      const hierarchyChain = this.getHierarchyChain(this.host.currentParentLabel);
      if (dotCount === 1 && this.host.currentParentLabel.endsWith(`_${localName}`)) {
        candidates.add(this.host.currentParentLabel);
      }
      const addExactLocalCandidate = (parentPrefix) => {
        candidates.add(`${parentPrefix}_${localName}`);
      };
      const addShortenedLocalCandidates = (parentPrefix) => {
        for (let i = 1; i < nestedLocalParts.length; i++) {
          candidates.add(`${parentPrefix}_${nestedLocalParts.slice(i).join("_")}`);
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
        try {
          return this.getLabelValueDirect(candidate, requireStatic);
        } catch {
        }
      }
    }
    const isMacroLabelRef = label.startsWith("?");
    if (isMacroLabelRef && this.host.inMacroExpansion) {
      const labelName = label.substring(1);
      if (labelName.includes("_")) {
        const [parentPart, subPart] = labelName.split("_", 2);
        const childLabel = `:macro_${this.host.macroLabelInstance}_.${subPart}`;
        if (this.host.labelTable.has(childLabel)) {
          const entry = this.host.labelTable.get(childLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
        const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${parentPart}_${subPart}`;
        if (this.host.labelTable.has(parentChildLabel)) {
          const entry = this.host.labelTable.get(parentChildLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
      }
      const macroLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
      if (this.host.labelTable.has(macroLabel)) {
        const entry = this.host.labelTable.get(macroLabel);
        if (requireStatic && !entry.isStatic) {
          throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
        }
        return entry.value;
      }
      if (labelName.startsWith(".")) {
        const macroLabelNoDot = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        if (this.host.labelTable.has(macroLabelNoDot)) {
          const entry = this.host.labelTable.get(macroLabelNoDot);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
      }
    }
    if (label.includes(":") || label.includes("_")) {
      return this.getLabelValueDirect(label, requireStatic);
    }
    if (this.host.namespaceNestingEnabled && this.host.namespaceNestingPath.length > 0) {
      for (let i = this.host.namespaceNestingPath.length; i >= 0; i--) {
        const namespacePath = this.host.namespaceNestingPath.slice(0, i);
        const namespacePrefix = namespacePath.join("_");
        const fullLabel = namespacePrefix ? `${namespacePrefix}_${label}` : label;
        try {
          return this.getLabelValueDirect(fullLabel, requireStatic);
        } catch (error) {
          if (!this.isMissingLabelError(error)) {
            throw error;
          }
          continue;
        }
      }
    }
    if (this.host.currentNamespace) {
      try {
        return this.getLabelValueDirect(`${this.host.currentNamespace}_${label}`, requireStatic);
      } catch (error) {
        if (!this.isMissingLabelError(error)) {
          throw error;
        }
      }
    }
    return this.getLabelValueDirect(label, requireStatic);
  }
  /**
   * Gets the value of a label directly.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValueDirect(label, requireStatic) {
    if (label.includes("_") && !label.includes(":")) {
      const parts = label.split("_");
      if (parts.length === 2) {
        const parentLabel = parts[0];
        const localLabel = `.${parts[1]}`;
        const combinedLabel = `${parentLabel}_${localLabel.replace(/^\./, "")}`;
        if (this.host.labelTable.has(combinedLabel)) {
          const entry2 = this.host.labelTable.get(combinedLabel);
          if (requireStatic && !entry2.isStatic) {
            throw new Error(`Error: Non-static label '${combinedLabel}' used in conditional.`);
          }
          return entry2.value;
        }
        if (this.host.labelTable.has(localLabel)) {
          const entry2 = this.host.labelTable.get(localLabel);
          if (requireStatic && !entry2.isStatic) {
            throw new Error(`Error: Non-static label '${localLabel}' used in conditional.`);
          }
          return entry2.value;
        }
        if (this.host.isDefinitionCollectionStage) {
          return 0;
        }
      }
    }
    if (!this.host.labelTable.has(label)) {
      if (this.host.isDefinitionCollectionStage) {
        return 0;
      }
      throw new Error(`Error: Label '${label}' not found.`);
    }
    const entry = this.host.labelTable.get(label);
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
    if (this.host.structs.has(workingIdentifier)) {
      const def2 = this.host.structs.get(workingIdentifier);
      if (baseOnly) {
        return def2.size;
      }
      return !def2.parent ? def2.size + (def2.extensionSize || 0) : def2.size;
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
    if (baseOnly) {
      return def.size;
    }
    return !def.parent ? def.size + (def.extensionSize || 0) : def.size;
  }
  /**
   * Handles a label definition.
   * @param {string} labelName The name of the label.
   */
  handleLabelDefinition(labelName) {
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
      this.setLabel(directScopeLabel, void 0, false, false, false, modifiesHierarchy2);
      if (modifiesHierarchy2) {
        this.host.currentParentLabel = directScopeLabel;
        this.host.currentParentIsGlobal = dotCount === 1;
      }
      if (this.host.currentNamespace) {
        const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
        if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
          const namespacedLabel = `${namespacePrefix}_${directScopeLabel}`;
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
        const namespacedLabel = `${namespacePrefix}_${labelName}`;
        this.setLabel(namespacedLabel, void 0, false, false, false, modifiesHierarchy);
      }
    }
  }
};

// src/file-provider.ts
import fs2 from "node:fs";
import path from "node:path";
var NodeAssemblyFileProvider = class {
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
  stat(filePath) {
    if (!fs2.existsSync(filePath)) {
      return {
        exists: false,
        readable: false
      };
    }
    try {
      fs2.accessSync(filePath, fs2.constants.R_OK);
      return {
        exists: true,
        readable: true,
        size: fs2.statSync(filePath).size
      };
    } catch {
      return {
        exists: true,
        readable: false
      };
    }
  }
  readFile(filePath) {
    return new Uint8Array(fs2.readFileSync(filePath));
  }
  readTextFile(filePath, encoding = "utf8") {
    return fs2.readFileSync(filePath, encoding);
  }
};
function createNodeAssemblyFileProvider() {
  return new NodeAssemblyFileProvider();
}
function stripWrappingQuotes(filename) {
  if (filename.startsWith('"') && filename.endsWith('"') || filename.startsWith("'") && filename.endsWith("'") || filename.startsWith("`") && filename.endsWith("`")) {
    return filename.slice(1, -1);
  }
  return filename;
}

// src/assembler.ts
var debug7 = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug7 = d("Assembler");
} catch {
}
var Assembler = class _Assembler {
  /** The current target address. `snespos` */
  currentTargetAddress = 0;
  /** The current target base address. `realsnespos` */
  currentTargetBaseAddress = 0;
  /** The current target start address. `startpos` */
  currentTargetStartAddress = 0;
  /** The current target base start address. `realstartpos` */
  currentTargetBaseStartAddress = 0;
  bytes = 0;
  pushBaseStack = [];
  /** Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom */
  mapper = "lorom";
  /** Disabled after `norom` to match Asar checksum behavior. */
  checksumFixEnabled = true;
  /** Header checksum algorithm mode: "asar" (default) or "simple". */
  checksumMode = "asar";
  /** Bank crossing policy controlled by `check bankcross ...`. */
  bankCrossCheckMode = "off";
  /** Read* functions are enabled when patch-style title check is active. */
  readFunctionsEnabled = false;
  /** Controls direct-page shortening for 65816 when no explicit length is given. */
  optimizeDirectPage = false;
  sa1banks = [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1];
  /** Placeholder for ROM */
  romdata = [];
  defaultFreespaceByte = 0;
  activeFreespaceStartPc = null;
  activeFreespaceContentStartPc = null;
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
  // Character mapping support
  characterMappings = /* @__PURE__ */ new Map();
  currentTable = null;
  tableStack = [];
  inFunctionDefinition = false;
  functionDefinitionLines = [];
  arch65816;
  archSPC700;
  archSuperFX;
  // Add a new property for architecture in the class:
  arch = "65816";
  pushpcStack = [];
  pushpcnum = 0;
  labelTable = /* @__PURE__ */ new Map();
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
  targetRom;
  // Add a static property to hold our CRC table.
  static crcTable = null;
  includedFiles = /* @__PURE__ */ new Map();
  includeStack = [];
  includePaths = ["./"];
  // Replace the existing loop tracking with a more structured approach
  loopStack = [];
  // Stack of active loop blocks being built
  currentLoop = null;
  // Reference to the loop block currently being constructed
  collectingLoop = false;
  // Flag to indicate we're collecting loop commands
  loopNestingLevel = 0;
  // Current nesting level for loops
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
  inSpcblock = false;
  spcblockData = null;
  spcInlineCompatMode = false;
  requireStaticLabelLookup = false;
  passProgramCache = /* @__PURE__ */ new Map();
  directiveRegistry;
  architectureRegistry;
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
  includeEdges = [];
  activeStageExecutionState = null;
  analysisErrorRecoveryEnabled = false;
  get defineEngine() {
    return this.services.defineEngine;
  }
  get directiveRuntime() {
    return this.services.directiveRuntime;
  }
  get frontEndCommandService() {
    return this.services.frontEndCommandService;
  }
  get macroEngine() {
    return this.services.macroEngine;
  }
  get symbolScope() {
    return this.services.symbolScope;
  }
  get romWriter() {
    return this.services.romWriter;
  }
  get structEngine() {
    return this.services.structEngine;
  }
  // Core assembler wrapper helpers
  get currentAddress() {
    return this.currentTargetAddress;
  }
  recordCurrentAddress() {
    this.addAddressToLine(this.currentTargetBaseAddress & 16777215);
  }
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
  enterStructDefinition(base) {
    this.savedPCStack.push(this.currentTargetAddress);
    this.cursorAddress.setWritePosition(base);
  }
  restoreStructDefinition() {
    if (this.savedPCStack.length === 0) {
      return;
    }
    const previousPosition = this.savedPCStack.pop();
    if (previousPosition !== void 0) {
      this.cursorAddress.setWritePosition(previousPosition);
    }
  }
  syncWriteStarts() {
    this.currentTargetStartAddress = this.currentTargetAddress;
    this.currentTargetBaseStartAddress = this.currentTargetBaseAddress;
  }
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
  }
  /**
   * Records a directed include-graph edge if it has not already been recorded.
   * Includes execute once per pass, so edges are de-duplicated by file pair.
   * @param {string} fromFile The file issuing the include directive.
   * @param {string} toFile The resolved path of the included file.
   */
  recordIncludeEdge(fromFile, toFile) {
    if (!fromFile || !toFile) {
      return;
    }
    const duplicate = this.includeEdges.some((edge) => edge.fromFile === fromFile && edge.toFile === toFile);
    if (duplicate) {
      return;
    }
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
   * Records a structured diagnostic.
   * @param {AssemblyDiagnostic} diagnostic The diagnostic to record.
   */
  reportDiagnostic(diagnostic) {
    this.diagnostics.push(diagnostic);
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
    this.reportDiagnostic(diagnostic);
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
    const file = options.file ?? this.currentFile;
    const line = options.line ?? this.currentLine;
    const duplicate = this.symbolDefinitions.some((entry) => entry.kind === kind && entry.name === name && entry.location.file === file && entry.location.line === line && entry.containerName === options.containerName);
    if (duplicate) {
      return;
    }
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
    const file = options.file ?? this.currentFile;
    const line = options.line ?? this.currentLine;
    const duplicate = this.symbolReferences.some((entry) => entry.kind === kind && entry.name === name && entry.location.file === file && entry.location.line === line && entry.containerName === options.containerName);
    if (duplicate) {
      return;
    }
    this.symbolReferences.push({
      name,
      kind,
      location: createAssemblySourceLocation(file, line, options.span),
      containerName: options.containerName
    });
  }
  collectExpressionReferences(expression, fallbackSpan) {
    if (!expression) {
      return;
    }
    switch (expression.type) {
      case "defineReference":
        if (expression.name || expression.content) {
          this.recordSymbolReference("define", expression.braced ? expression.content ?? "" : expression.name ?? "", {
            span: expression.span ?? fallbackSpan
          });
        }
        return;
      case "identifier":
        this.recordSymbolReference("label", expression.name, {
          span: expression.span ?? fallbackSpan
        });
        return;
      case "member":
      case "index":
        this.recordSymbolReference("label", renderReferenceExpressionNode(expression), {
          span: expression.span ?? fallbackSpan
        });
        if (expression.type === "index") {
          this.collectExpressionReferences(expression.index, fallbackSpan);
        }
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
  collectCommandReferences(command) {
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
      this.recordSymbolReference("include", parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"), {
        span: command.source.tokenSpans[1] ?? fallbackSpan
      });
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
   * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
   */
  collectProgramAnalysis(program) {
    this.clearAnalysisArtifacts();
    this.analysisErrorRecoveryEnabled = true;
    try {
      this.assembleProgram(program);
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
    const session = new _Assembler(this.targetRom, { fileProvider: this.fileProvider });
    session.directiveRegistry = this.cloneDirectiveRegistryForSession(session);
    session.architectureRegistry = this.architectureRegistry;
    session.includePaths = [...this.includePaths];
    session.mapper = this.mapper;
    session.checksumFixEnabled = this.checksumFixEnabled;
    session.checksumMode = this.checksumMode;
    session.bankCrossCheckMode = this.bankCrossCheckMode;
    session.readFunctionsEnabled = this.readFunctionsEnabled;
    session.optimizeDirectPage = this.optimizeDirectPage;
    session.defaultFreespaceByte = this.defaultFreespaceByte;
    session.padbyte = [...this.padbyte];
    session.fillbyte = [...this.fillbyte];
    session.padUnit = this.padUnit;
    session.arch = this.arch;
    session.sa1banks = [...this.sa1banks];
    return session;
  }
  /**
   * Rebinds directive handlers to a fresh session while preserving any custom
   * registrations present on the current registry.
   * @param {Assembler} session The session that should receive directive calls.
   * @returns {DirectiveRegistry} A registry bound to the provided session.
   */
  cloneDirectiveRegistryForSession(session) {
    const registry = new DirectiveRegistry({
      session,
      operandResolver: session.operandResolver
    });
    for (const [keyword, handler] of this.directiveRegistry.handlers.entries()) {
      registry.handlers.set(keyword, handler);
    }
    return registry;
  }
  analyzeProgram(program) {
    return this.createToolingSession().collectProgramAnalysis(program);
  }
  /**
   * Builds and analyzes raw source without throwing on the first error.
   * @param {string} source The source to analyze.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
   */
  analyzeSource(source, sourceFile = this.currentFile, startLine = 0) {
    const session = this.createToolingSession();
    const program = session.buildProgramModel(source, sourceFile, startLine);
    return {
      program,
      ...session.collectProgramAnalysis(program)
    };
  }
  analyzeDocument(source, sourceFile = this.currentFile, startLine = 0) {
    return this.analyzeSource(source, sourceFile, startLine);
  }
  analyzeWorkspace(documents2) {
    const results = [];
    for (const document of documents2) {
      const session = this.createToolingSession();
      const program = session.buildProgramModel(document.source, document.sourceFile, document.startLine ?? 0);
      const result = session.collectProgramAnalysis(program);
      results.push({
        sourceFile: document.sourceFile,
        program,
        ...result
      });
    }
    return results;
  }
  loadTestRomData() {
    const testRomSize = 512 * 1024;
    if (!this.targetRom || this.targetRom.length === 0) {
      return;
    }
    for (let i = 0; i < Math.min(testRomSize, this.targetRom.length); i++) {
      this.romdata[i] = this.targetRom[i];
    }
  }
  // Shared adapter infrastructure
  createCursorAddressFacade() {
    return {
      recordCurrentAddress: () => this.recordCurrentAddress(),
      setWritePosition: (address) => this.setWritePosition(address),
      syncWriteStarts: () => this.syncWriteStarts(),
      incrementBytesWritten: (num) => this.incrementBytesWritten(num)
    };
  }
  // Service assembly
  createServices() {
    const defineEngine = new DefineEngine(this);
    const directiveRuntime = new DirectiveRuntimeService(this);
    const frontEndCommandService = new FrontEndCommandService(this);
    const symbolScope = new SymbolScopeService(this);
    const romWriter = new RomWriterService(this);
    const macroEngine = new MacroEngine(this);
    const structEngine = new StructEngine(this);
    return {
      defineEngine,
      directiveRuntime,
      fileProvider: this.fileProvider,
      frontEndCommandService,
      macroEngine,
      romWriter,
      structEngine,
      symbolScope
    };
  }
  constructor(targetRom, options = {}) {
    this.targetRom = targetRom ? Uint8Array.from(targetRom) : new Uint8Array();
    this.fileProvider = options.fileProvider ?? createNodeAssemblyFileProvider();
    this.cursorAddress = this.createCursorAddressFacade();
    this.mathCore = new MathCore();
    this.mathCore.host = this.expressionHost;
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
      isDefinitionCollectionStage: { get: () => this.isDefinitionCollectionStage }
    });
    this.frontEndService = new AssemblyFrontEndService(frontEndHost);
    this.programModelBuilder = this.frontEndService.programModelBuilder;
    this.incrementalProgramParseState = this.frontEndService.createIncrementalParseState();
    this.operandResolver = new OperandResolver({
      resolveDefines: (input) => this.resolvedefines(input),
      resolveStructLabel: (input) => this.structEngine.resolveStructLabel(input),
      resolveLabel: (input, requireStatic) => this.symbolScope.getLabelValue(input, requireStatic),
      hasLabel: (input) => this.symbolScope.hasLabelInScope(input),
      evaluateMath: (input) => this.mathCore.math(input),
      shouldDeferExpressionEvaluation: () => !this.getActiveStageCapabilities().enforceResolvedLabels,
      getCurrentAddress: () => this.currentTargetAddress,
      requireStaticLabelLookup: () => this.requireStaticLabelLookup
    });
    this.arch65816 = new Arch65816(this);
    this.archSPC700 = new ArchSPC700(this);
    this.archSuperFX = new ArchSuperFX(this);
    this.architectureRegistry = createArchitectureRegistry(
      this.arch65816,
      this.archSPC700,
      this.archSuperFX
    );
    this.directiveRegistry = createDirectiveRegistry(this, this.operandResolver);
    this.commandLoweringService = new CommandLoweringService(this);
    this.services.frontEnd = this.frontEndService;
    this.services.lowering = this.commandLoweringService;
    this.activateStage("collectDefinitions");
  }
  /**
   * Sets ROM header checksum calculation mode.
   * @param {"asar" | "simple"} mode The checksum mode to use.
   */
  setChecksumMode(mode) {
    this.checksumMode = mode;
  }
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
  canReadByteRange(sourceLength, position, size) {
    const pos = Math.trunc(position);
    const num = Math.trunc(size);
    return Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= sourceLength ? 1 : 0;
  }
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
  resolveReadablePath(filename) {
    return this.fileProvider.resolvePath(filename, {
      currentFile: this.currentFile,
      includePaths: this.includePaths,
      macroSourceFile: this.currentMacroSourceFile
    });
  }
  resolveExpressionHostLabel(identifier) {
    const parsed = parseExpressionNode(identifier.trim());
    if (isReferenceExpressionNode(parsed)) {
      return this.resolveReferenceLabelValue(parsed, this.requireStaticLabelLookup);
    }
    return this.symbolScope.getLabelValue(identifier, this.requireStaticLabelLookup);
  }
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
  lookupDefineValue(varName) {
    const defineValue = this.defines.get(varName);
    if (defineValue !== void 0) {
      return defineValue;
    }
    for (let i = this.whileStatus.length - 1; i >= 0; i--) {
      const loop = this.whileStatus[i];
      if (loop.is_for && loop.for_variable === varName) {
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
  canReadTargetRom(position, size) {
    const sourceLength = this.targetRom && this.targetRom.length > 0 ? this.targetRom.length : this.romdata.length;
    return this.canReadByteRange(sourceLength, position, size);
  }
  readTargetRom(position, size, defaultValue) {
    const pos = Math.trunc(position);
    if (!this.readFunctionsEnabled && defaultValue === void 0) {
      throw new Error(`Esnes_address_out_of_bounds: SNES address ${pos.toString(16).toUpperCase().padStart(6, "0")} in read function out of bounds.`);
    }
    const pcPos = this.romWriter.convertTargetAddressToRomOffset(pos);
    const source = this.targetRom && this.targetRom.length > 0 ? this.targetRom : this.romdata;
    if (pcPos < 0) {
      if (defaultValue !== void 0) {
        return defaultValue;
      }
      throw new Error(`read${Math.trunc(size)} out of bounds at ${pos}`);
    }
    const romBytes = Uint8Array.from(source);
    return this.readByteRange(romBytes, pcPos, size, defaultValue, `read${Math.trunc(size)} out of bounds at ${pos}`);
  }
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
    return this.readByteRange(fileBytes, pos, size, defaultValue, `readfile${Math.trunc(size)} out of bounds at ${pos}`);
  }
  expressionHost = {
    resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
    convertSnesToPc: (address) => this.romWriter.convertTargetAddressToRomOffset(address),
    convertPcToSnes: (offset) => this.romWriter.pctosnes(offset),
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
    canReadRom: (position, size) => this.canReadTargetRom(position, size),
    readRom: (position, size, defaultValue) => this.readTargetRom(position, size, defaultValue)
  };
  /**
   * Advances memory position while handling bank crossing.
   * @param {number} num The number of bytes to advance.
   */
  step(num) {
    this.romWriter.step(num);
  }
  /**
   * Writes a single byte to ROM.
   * @param {number} num - The byte to write.
   */
  write1_65816(num) {
    this.romWriter.write1_65816(num);
  }
  /**
   * Fills a section of ROM data with a value.
   * @param {number} start The starting address.
   * @param {number} value The value to fill with.
   * @param {number} length The length of the section to fill.
   */
  fillRomData(start, value, length) {
    debug7("fillRomData", start, value, length);
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value & 255;
    }
  }
  createEphemeralStageExecutionState(stage) {
    const descriptor = this.getStageDescriptor(stage);
    return {
      ...descriptor,
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
        loopStack: this.loopStack,
        currentLoop: this.currentLoop,
        collectingLoop: this.collectingLoop,
        loopNestingLevel: this.loopNestingLevel,
        inMacroExpansion: this.inMacroExpansion,
        macroLabelInstance: this.macroLabelInstance
      },
      writeState: {
        inSpcblock: this.inSpcblock,
        spcblockData: this.spcblockData,
        spcInlineCompatMode: this.spcInlineCompatMode,
        activeFreespaceStartPc: this.activeFreespaceStartPc,
        activeFreespaceContentStartPc: this.activeFreespaceContentStartPc
      },
      loweredProgram: null
    };
  }
  syncActiveStageExecutionState(stage) {
    const descriptor = this.getStageDescriptor(stage);
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState = this.createEphemeralStageExecutionState(stage);
      return;
    }
    this.activeStageExecutionState.stage = descriptor.stage;
    this.activeStageExecutionState.capabilities = descriptor.capabilities;
  }
  getActiveStageCapabilities() {
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState = this.createEphemeralStageExecutionState("collectDefinitions");
    }
    return this.activeStageExecutionState.capabilities;
  }
  get traceStage() {
    return this.activeStageExecutionState?.stage ?? "collectDefinitions";
  }
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
      if (architecture.name === "superfx") {
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
    debug7("asblock_pick", Array.isArray(input) ? input : input.words);
    debug7("asblock_pick arch", this.arch);
    const instructionExecutionMode = this.getActiveStageCapabilities().instructionMode;
    if (instructionExecutionMode === "layout") {
      return this.layoutInstruction(input);
    }
    return this.emitInstruction(input);
  }
  resolveActiveArchitecture() {
    if (this.inSpcblock || this.arch === "spc700") {
      return {
        name: "spc700",
        definition: this.architectureRegistry.getDefinition("spc700")
      };
    }
    const normalized = this.arch.toLowerCase();
    const canonical = this.architectureRegistry.getCanonicalName(normalized);
    const name = canonical ?? normalized;
    return {
      name,
      definition: this.architectureRegistry.getDefinition(name)
    };
  }
  classifyOperandForActiveArchitecture(operand) {
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return this.operandResolver.lowerOperand(operand);
    }
    return architecture.definition.classifyOperand(this.operandResolver, operand);
  }
  /**
   * Writes 1, 2, 3, or 4 bytes to ROM.
   * @param {number} num - The byte to write.
   */
  write1(num) {
    this.romWriter.write1(num);
  }
  emitByte(num) {
    this.write1(num);
  }
  write2(num) {
    this.romWriter.write2(num);
  }
  emitWord(num) {
    this.write2(num);
  }
  write3(num) {
    this.romWriter.write3(num);
  }
  emitLong(num) {
    this.write3(num);
  }
  write4(num) {
    this.romWriter.write4(num);
  }
  /**
   * Reads 1, 2, or 3 bytes from ROM.
   * @param {number} insnespos - The SNES address to read from.
   * @returns {number} The byte read from ROM.
   */
  read1(insnespos) {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 1 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr];
  }
  read2(insnespos) {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 2 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr] | this.romdata[addr + 1] << 8;
  }
  read3(insnespos) {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 3 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr] | this.romdata[addr + 1] << 8 | this.romdata[addr + 2] << 16;
  }
  assembleblock(block) {
    if (!block.trim()) {
      return;
    }
    const processedCommands = this.preprocessBlockCommands(block);
    block = processedCommands.join("\n");
    const words = block.trim().split(/\s+/);
    if (words.length === 0) {
      debug7("assembler assembleblock no words", { words });
      return;
    }
    const splitCommands = splitInlineCommands(processedCommands);
    if (block.includes("\n") && this.incrementalProgramParseState.roots.length === 0) {
      const nodes = this.getOrBuildPassProgram(splitCommands, this.currentFile, this.currentLine);
      this.executeNodeStream(nodes);
      return;
    }
    for (const command of splitCommands) {
      const nodes = this.frontEndService.consumeIncrementalCommand(
        this.incrementalProgramParseState,
        command.trim(),
        this.currentFile,
        this.currentLine
      );
      this.executeNodeStream(nodes);
    }
  }
  preprocessBlockCommands(block) {
    return this.frontEndService.preprocessBlockCommands(block);
  }
  rewriteRawCommand(command) {
    return this.macroEngine.rewriteMacroLabelReferences(command);
  }
  createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty = false) {
    return this.frontEndService.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty);
  }
  preprocessNormalizedCommand(state) {
    if (state.words.length === 3 && state.words[1] === "=" && (state.words[0].startsWith("'") || state.words[0].startsWith('"'))) {
      setCommandKind(state, "characterMapping");
      this.handleCharacterMapping(state);
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
  prepareNormalizedCommandForDispatch(state) {
    if (state.kind === "unknown") {
      setCommandWords(state, state.words, state.command);
      setCommandKind(state, "opcodeCandidate");
    }
    return true;
  }
  /**
   * Processes a single command from `assembleblock`.
   * @param {string} command - The command to process.
   */
  processCommand(command) {
    debug7("processCommand", { command }, this.currentTargetAddress, "/", this.currentTargetAddress.toString(16), `stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`);
    if (command.trim() === "") {
      return;
    }
    command = this.rewriteRawCommand(command);
    if (this.frontEndCommandService.continueFunctionDefinition(command)) {
      return;
    }
    this.assembleblock(command);
    this.flushCompletedIncrementalNodes();
  }
  processNormalizedCommand(state, rewriteRaw = true) {
    let workingState = cloneNormalizedCommand(state);
    if (workingState.source.raw.trim().startsWith(";`+")) {
      this.loadTestRomData();
      return;
    }
    if (workingState.command.trim() === "") {
      return;
    }
    if (rewriteRaw) {
      const rewrittenRaw = this.rewriteRawCommand(workingState.source.raw);
      const rewrittenState = this.createNormalizedCommandFromRaw(
        rewrittenRaw,
        workingState.source.file,
        workingState.source.line,
        true
      );
      if (!rewrittenState) {
        return;
      }
      if (rewrittenRaw !== workingState.source.raw || rewrittenState.command !== workingState.command) {
        workingState = rewrittenState;
      }
    }
    const preprocessResult = this.preprocessNormalizedCommand(workingState);
    if (preprocessResult === "handled") {
      return;
    }
    const startPC = this.currentTargetBaseAddress & 16777215;
    if (!this.prepareNormalizedCommandForDispatch(workingState)) {
      return;
    }
    this.collectCommandReferences(workingState);
    const traceContext = {
      file: workingState.source.file,
      line: workingState.source.line,
      raw: workingState.source.raw,
      normalized: workingState.command
    };
    this.traceListener?.({
      type: "command-start",
      stage: this.traceStage,
      arch: this.arch,
      ...traceContext,
      snesAddress: startPC,
      pcAddress: this.romWriter.convertTargetAddressToRomOffset(startPC)
    });
    this.traceCommandStack.push(traceContext);
    try {
      const lowered = this.lowerNode(workingState);
      this.dispatchLoweredNode(lowered);
    } finally {
      this.traceCommandStack.pop();
    }
    const commandSize = (this.currentTargetBaseAddress & 16777215) - startPC;
    debug7("processCommand bytes written", commandSize);
    const endPC = this.currentTargetBaseAddress & 16777215;
    this.traceListener?.({
      type: "command-end",
      stage: this.traceStage,
      arch: this.arch,
      ...traceContext,
      snesAddress: startPC,
      pcAddress: this.romWriter.convertTargetAddressToRomOffset(startPC),
      endSnesAddress: endPC,
      endPcAddress: this.romWriter.convertTargetAddressToRomOffset(endPC),
      bytesWritten: commandSize
    });
    this.addAddressToLine(this.currentTargetBaseAddress & 16777215);
  }
  getOrCreateLoweredProgram(stageState, program) {
    if (!stageState.loweredProgram) {
      stageState.loweredProgram = this.commandLoweringService.lowerProgram(program);
    }
    return stageState.loweredProgram;
  }
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
        debug7("\u{1F4A5} assembler dispatchLoweredNode unknown directive", lowered.keyword);
      }
      return;
    }
    const wasOpcode = this.asblock_pick(lowered);
    if (!wasOpcode) {
      debug7("\u{1F4A5} assembler dispatchLoweredNode unknown operation", lowered.mnemonic);
    }
  }
  handleSpcblock(words) {
    this.directiveRuntime.handleSpcblock(words);
  }
  handleEndSpcblock(words) {
    this.directiveRuntime.handleEndSpcblock(words);
  }
  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param {string} defLine - The function definition line.
   */
  parseFunctionDefinition(defLine) {
    debug7("parseFunctionDefinition", defLine);
    this.mathCore.str = defLine;
    this.mathCore.parseFunctionDefinition();
    const functionName = defLine.match(/^function\s+([_a-z]\w*)\s*\(/i)?.[1];
    if (functionName) {
      this.recordSymbolDefinition("function", functionName);
    }
  }
  /**
   * Adds a mapping of the current address to the source line number.
   * @param {number} address The SNES address to add to the mapping.
   */
  addAddressToLine(address) {
    this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
  }
  /**
   * Handles `org` directive to set SNES memory location.
   * @param {string[]} params - The parameters for the org directive.
   */
  handleOrg(params) {
    this.directiveRuntime.handleOrg(params);
  }
  /**
   * Handles `db`, `dw`, `dl`, `dd` directives for defining data.
   * @param {string} type - The type of data directive.
   * @param {string[]} params - The parameters for the data directive.
   */
  handleDataDirective(type, params) {
    this.directiveRuntime.handleDataDirective(type, params);
  }
  /**
   * Writes data of the specified length.
   * @param {number} len The length of the data to write.
   * @param {number} value The value to write.
   */
  writeDataByLength(len, value) {
    this.directiveRuntime.writeDataByLength(len, value);
  }
  /**
   * Pushes the current PC onto the pushpcStack.
   */
  handlePushPC() {
    this.directiveRuntime.handlePushPC();
  }
  /**
   * Restores the previous PC.
   */
  handlePullPC() {
    this.directiveRuntime.handlePullPC();
  }
  /**
   * Evaluates a range expression and returns the result.
   * @param {string} expr The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateRangeExpression(expr) {
    debug7("assemlber evaluateRangeExpression", expr);
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
    debug7("evaluateExpression", expression);
    let resolvedExpr;
    let result;
    try {
      resolvedExpr = this.resolveExpressionInput(expression);
      debug7("evaluateExpression resolvedExpr", resolvedExpr);
      result = isReferenceExpressionNode(resolvedExpr) ? this.evaluateReferenceExpressionNode(resolvedExpr) : this.mathCore.math(resolvedExpr);
    } catch (e) {
      const originalExpr = typeof expression === "string" ? expression : renderExpressionNode(expression);
      const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
      throw new Error(`Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
    debug7("evaluateExpression result", result, "=>", result !== 0);
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
          return { type: "raw", value: `${renderExpressionNode(object)}.${expression.property.name}` };
        }
        return {
          ...expression,
          object
        };
      }
      case "index": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        const index2 = this.resolveExpressionNode(expression.index);
        if (!isReferenceExpressionNode(object)) {
          const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
          if (expandedReference) {
            return expandedReference;
          }
          return { type: "raw", value: `${renderExpressionNode(object)}[${renderExpressionNode(index2)}]` };
        }
        return {
          ...expression,
          object,
          index: index2
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
    return this.resolveNormalizedReferenceLabelValue(this.renderResolvedReferenceExpression(resolved), requireStatic);
  }
  /**
   * Resolves an already-normalized reference string as either a struct member/base
   * or a plain label lookup.
   * @param {string} normalizedReference The normalized reference text.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The resolved numeric address/value.
   */
  resolveNormalizedReferenceLabelValue(normalizedReference, requireStatic = false) {
    if (normalizedReference.includes(".") || normalizedReference.includes("[")) {
      try {
        return this.structEngine.resolveStructLabel(normalizedReference);
      } catch {
      }
    }
    if (this.structs.has(normalizedReference)) {
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
    debug7(`resolvedefines handling relative label: ${input}`);
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
        debug7("resolvedefines stage does not enforce labels, returning placeholder");
        return "$0000";
      }
      debug7(`resolvedefines failed to resolve relative label ${input}: ${error instanceof Error ? error.message : ""} during stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`);
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
    debug7("resolvedefines direct variable reference", input);
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
    debug7("resolvedefines macro label found with prefix", { prefix, labelName });
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
    debug7("resolvedefines checking if input is a label reference", input);
    try {
      const labelValue = this.symbolScope.getLabelValue(input, false);
      debug7("resolvedefines labelValue", labelValue);
      return labelValue.toString();
    } catch (error) {
      debug7("resolvedefines not a label, continuing", error);
      return void 0;
    }
  }
  /**
   * Resolves all define replacements in a given string.
   * @param {string} input The string to resolve defines in.
   * @returns {string} The string with defines resolved.
   */
  resolvedefines(input) {
    debug7("resolvedefines", { input });
    if (!input) {
      debug7("resolvedefines input is empty, returning empty string");
      return "";
    }
    let result = "";
    let index2 = 0;
    const resolvedRelativeLabel = this.tryResolveRelativeLabelToken(input);
    if (resolvedRelativeLabel !== void 0) {
      return resolvedRelativeLabel;
    }
    if (input.includes("!=")) {
      debug7("resolvedefines != operator found in", input);
      const parts = input.split("!=");
      const resolvedParts = parts.map((part) => this.resolvedefines(part.trim()));
      return resolvedParts.join("!=");
    }
    if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
      debug7("resolvedefines sizeof found, skipping", input);
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
    while (index2 < input.length) {
      const char = input[index2];
      if (char === "\\" && input[index2 + 1] === "\\") {
        debug7("resolvedefines double slash", input);
        result += "\\";
        index2 += 2;
      } else if (char === "\\" && input[index2 + 1] === "!") {
        debug7("resolvedefines \\!define", input);
        result += "!";
        index2 += 2;
      } else if (char === "!") {
        debug7("resolvedefines !define", input);
        let defineName = "";
        index2++;
        if (input[index2] === "{") {
          index2++;
          let unprocessedName = "";
          let braces = 1;
          while (index2 < input.length) {
            if (input[index2] === "{") braces++;
            if (input[index2] === "}") braces--;
            if (braces === 0) break;
            unprocessedName += input[index2++];
          }
          if (braces !== 0) throw new Error("Error: Mismatched braces in define name.");
          index2++;
          defineName = this.resolvedefines(unprocessedName);
          debug7("resolvedefines !define defineName", defineName);
        } else {
          while (index2 < input.length && /\w/.test(input[index2])) {
            defineName += input[index2++];
          }
          debug7("resolvedefines !define defineName", defineName);
        }
        const value = this.lookupDefineValue(defineName);
        if (value === void 0) {
          throw new Error(`Define '${defineName}' not found.`);
        } else {
          result += value;
        }
      } else {
        result += char;
        index2++;
      }
    }
    debug7("resolvedefines result =", { result });
    return result;
  }
  activateStage(stage) {
    debug7("\u{1F3C1} activateStage", stage);
    this.syncActiveStageExecutionState(stage);
    if (stage === "resolveLayout") {
      this.forwardLabels = {};
      this.backwardLabels = {};
    }
    this.macroLabelInstance = null;
    for (const [filePath, fileInfo] of this.includedFiles.entries()) {
      fileInfo.guarded = false;
      this.includedFiles.set(filePath, fileInfo);
    }
    this.inMacroExpansion = false;
    this.collectingLoop = false;
    this.currentLoop = null;
    this.frontEndService.resetIncrementalParseState(this.incrementalProgramParseState);
    this.inSpcblock = false;
    this.spcblockData = null;
    this.spcInlineCompatMode = false;
  }
  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass() {
    this.romWriter.finishPass();
    if (this.getActiveStageCapabilities().canFinalize) {
      this.passProgramCache.clear();
    }
  }
  /**
   * Sets the current file being processed.
   * @param {string} filename - The filename to set.
   */
  setCurrentFile(filename) {
    debug7("setCurrentFile", filename);
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
  cloneRelativeLabels(source) {
    const clone = {};
    for (const [depth, entries] of Object.entries(source)) {
      clone[Number(depth)] = entries.map((entry) => ({ ...entry }));
    }
    return clone;
  }
  createStageExecutionState(stage) {
    const descriptor = this.getStageDescriptor(stage);
    const previousStage = stage === "resolveLayout" ? "collectDefinitions" : stage === "emitProgram" ? "resolveLayout" : void 0;
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
      loopStack: this.loopStack,
      currentLoop: this.currentLoop,
      collectingLoop: this.collectingLoop,
      loopNestingLevel: this.loopNestingLevel,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance
    };
    const writeSeed = seed?.writeState ?? {
      inSpcblock: this.inSpcblock,
      spcblockData: this.spcblockData,
      spcInlineCompatMode: this.spcInlineCompatMode,
      activeFreespaceStartPc: this.activeFreespaceStartPc,
      activeFreespaceContentStartPc: this.activeFreespaceContentStartPc
    };
    return {
      ...descriptor,
      cursor: { ...cursorSeed },
      symbols: {
        labelTable: new Map(Array.from(symbolSeed.labelTable.entries()).map(([key, value]) => [key, { ...value }])),
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
        loopStack: [...controlSeed.loopStack],
        currentLoop: controlSeed.currentLoop,
        collectingLoop: controlSeed.collectingLoop,
        loopNestingLevel: controlSeed.loopNestingLevel,
        inMacroExpansion: controlSeed.inMacroExpansion,
        macroLabelInstance: controlSeed.macroLabelInstance
      },
      writeState: {
        inSpcblock: writeSeed.inSpcblock,
        spcblockData: writeSeed.spcblockData ? { ...writeSeed.spcblockData } : null,
        spcInlineCompatMode: writeSeed.spcInlineCompatMode,
        activeFreespaceStartPc: writeSeed.activeFreespaceStartPc,
        activeFreespaceContentStartPc: writeSeed.activeFreespaceContentStartPc
      },
      loweredProgram: null
    };
  }
  applyStageExecutionState(stageState) {
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
    this.loopStack = stageState.control.loopStack;
    this.currentLoop = stageState.control.currentLoop;
    this.collectingLoop = stageState.control.collectingLoop;
    this.loopNestingLevel = stageState.control.loopNestingLevel;
    this.inMacroExpansion = stageState.control.inMacroExpansion;
    this.macroLabelInstance = stageState.control.macroLabelInstance;
    this.inSpcblock = stageState.writeState.inSpcblock;
    this.spcblockData = stageState.writeState.spcblockData;
    this.spcInlineCompatMode = stageState.writeState.spcInlineCompatMode;
    this.activeFreespaceStartPc = stageState.writeState.activeFreespaceStartPc;
    this.activeFreespaceContentStartPc = stageState.writeState.activeFreespaceContentStartPc;
  }
  captureStageExecutionState(stageState) {
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
      loopStack: this.loopStack,
      currentLoop: this.currentLoop,
      collectingLoop: this.collectingLoop,
      loopNestingLevel: this.loopNestingLevel,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance
    };
    stageState.writeState = {
      inSpcblock: this.inSpcblock,
      spcblockData: this.spcblockData,
      spcInlineCompatMode: this.spcInlineCompatMode,
      activeFreespaceStartPc: this.activeFreespaceStartPc,
      activeFreespaceContentStartPc: this.activeFreespaceContentStartPc
    };
  }
  getOrCreateStageExecutionState(stage) {
    const existing = this.stageExecutionStates.get(stage);
    if (existing) {
      return existing;
    }
    const created = this.createStageExecutionState(stage);
    this.stageExecutionStates.set(stage, created);
    return created;
  }
  buildProgramModel(source, sourceFile = this.currentFile, startLine = 0) {
    const program = this.frontEndService.buildProgramModel(source, sourceFile, startLine);
    return {
      sourceFile: program.sourceFile,
      startLine: program.startLine,
      nodes: program.nodes
    };
  }
  runStage(stage, program) {
    if (stage === "collectDefinitions") {
      this.stageExecutionStates.clear();
      this.activeStageExecutionState = null;
    }
    const stageState = this.getOrCreateStageExecutionState(stage);
    this.activeStageExecutionState = stageState;
    this.applyStageExecutionState(stageState);
    this.setCurrentFile(program.sourceFile);
    this.activateStage(stage);
    const loweredProgram = this.getOrCreateLoweredProgram(stageState, program);
    this.executeLoweredNodeStream(loweredProgram.nodes);
    this.finishPass();
    this.captureStageExecutionState(stageState);
    return stageState;
  }
  assembleProgram(program) {
    this.runStage("collectDefinitions", program);
    this.runStage("resolveLayout", program);
    this.runStage("emitProgram", program);
  }
  assembleSource(source, sourceFile = this.currentFile, startLine = 0) {
    const program = this.buildProgramModel(source, sourceFile, startLine);
    this.assembleProgram(program);
    return program;
  }
  /**
   * Writes a block of data to ROM.
   * @param {number} start The starting address of the block to write.
   * @param {number} value The byte value to write.
   * @param {number} [length] The length of the block to write.
   */
  writeDataBytes(start, value, length = 1) {
    debug7("writeDataBytes", { start, value, length });
    if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
      throw new Error("writeDataBytes requires a number for start, value, and length");
    }
    if (value > 255) {
      debug7("writeDataBytes \u{1F4A5} value must be less than 0xFF", value);
    }
    debug7("writeDataBytes before this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value & 255;
    }
    debug7("writeDataBytes after this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
  }
  /**
   * Expands ROM size and fills it with a specified byte.
   * @param {number} newSize The new size of the ROM.
   * @param {number} fsByte The byte value to fill the ROM with.
   */
  expandRom(newSize, fsByte) {
    debug7("expandRom", { newSize, fsByte });
    if (typeof newSize !== "number" || typeof fsByte !== "number") {
      throw new Error("expandRom requires a number for newSize and fsByte");
    }
    if (newSize > this.romdata.length) {
      this.writeDataBytes(this.romdata.length, fsByte, newSize - this.romdata.length);
    } else {
      debug7("expandRom newSize <= this.romdata.length, no expansion needed");
    }
  }
  /**
   * Updates the header checksum (16-bit) and CRC32.
   * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
   */
  updateHeaderAndCRC32() {
    debug7("updateHeaderAndCRC32");
    let headerOffset;
    if (this.mapper === "lorom" || this.mapper === "sa1rom" || this.mapper === "bigsa1rom") {
      headerOffset = 32704;
    } else if (this.mapper === "hirom" || this.mapper === "exhirom") {
      headerOffset = 65472;
    } else {
      headerOffset = 65472;
    }
    debug7("updateHeaderAndCRC32 headerOffset", headerOffset);
    if (this.romdata.length < headerOffset + 32) {
      debug7("ROM too small for header update.");
      return;
    }
    this.romdata[headerOffset + 28] = 255;
    this.romdata[headerOffset + 29] = 255;
    this.romdata[headerOffset + 30] = 0;
    this.romdata[headerOffset + 31] = 0;
    const romLength = this.romdata.length;
    let checksum = 0;
    if (this.checksumMode === "simple") {
      for (let i = 0; i < romLength; i++) {
        checksum += this.romdata[i] & 255;
      }
    } else {
      const isPowerOfTwo = romLength > 0 && (romLength & romLength - 1) === 0;
      if (isPowerOfTwo) {
        for (let i = 0; i < romLength; i++) {
          checksum += this.romdata[i] & 255;
        }
      } else {
        let bitround = 1;
        while (bitround < romLength) {
          bitround <<= 1;
        }
        const firstPart = bitround >> 1;
        const secondPart = romLength - firstPart;
        const repeatCount = Math.floor(firstPart / secondPart);
        let secondPartSum = 0;
        for (let i = 0; i < firstPart; i++) {
          checksum += this.romdata[i] & 255;
        }
        for (let i = firstPart; i < romLength; i++) {
          secondPartSum += this.romdata[i] & 255;
        }
        checksum += secondPartSum * repeatCount;
      }
    }
    checksum &= 65535;
    const complement = ~checksum & 65535;
    this.romdata[headerOffset + 28] = complement & 255;
    this.romdata[headerOffset + 29] = complement >> 8 & 255;
    this.romdata[headerOffset + 30] = checksum & 255;
    this.romdata[headerOffset + 31] = checksum >> 8 & 255;
    const crc32 = CRC32.compute(this.romdata);
    debug7(`Header updated: Checksum = 0x${checksum.toString(16).toUpperCase()}, Complement = 0x${complement.toString(16).toUpperCase()}, CRC32 = 0x${crc32.toString(16).toUpperCase()}`);
  }
  /**
   * Returns the compiled binary output.
   * @returns {Uint8Array} The compiled binary output.
   */
  getBinaryOutput = () => {
    return new Uint8Array(this.romdata.slice(0, this.romdata.length));
  };
  /**
   * Reads a file and returns its contents as a Uint8Array or string.
   * @param {string} filePath The path to the file to read.
   * @param {BufferEncoding} [encoding] Optional encoding. If provided, returns a string.
   * @returns {Uint8Array | string} The contents of the file as a Uint8Array or string.
   * @throws {Error} If the file is not found or cannot be read.
   */
  readFile(filePath, encoding) {
    debug7("readFile", filePath, encoding);
    try {
      const fullPath = this.fileProvider.resolvePath(filePath, {
        currentFile: this.currentFile,
        includePaths: this.includePaths,
        macroSourceFile: this.currentMacroSourceFile
      });
      if (!fullPath) {
        throw new Error(`Error reading file: ${filePath}`);
      }
      debug7("readFile:", fullPath);
      if (encoding) {
        return this.fileProvider.readTextFile(fullPath, encoding);
      }
      return this.fileProvider.readFile(fullPath);
    } catch (error) {
      debug7("Error reading file:", error);
      throw new Error(`Error reading file: ${filePath}`);
    }
  }
  /**
   * Resolves the path of an included file.
   * @param {string} filename The filename to resolve.
   * @returns {string} The resolved path.
   * @throws {Error} If the file is not found.
   */
  resolveIncludePath = (filename) => {
    debug7("resolveIncludePath", filename);
    if (filename == null || filename === void 0) {
      throw new Error("Invalid or missing filename");
    }
    const resolved = this.fileProvider.resolvePath(filename, {
      currentFile: this.currentFile,
      includePaths: this.includePaths,
      macroSourceFile: this.currentMacroSourceFile
    });
    if (!resolved) {
      throw new Error(`Could not find file: ${filename}`);
    }
    return resolved;
  };
  /**
   * Handles the include command, adding the current file to the guarded set if once is true.
   * @param {string} command The command to handle.
   * @param {string} filename The filename to include.
   * @param {boolean} once Whether the file should be included once.
   * @throws {Error} If the file is included again while command ===.
   */
  handleInclude = (command, filename, once = false) => {
    debug7("handleInclude", command, filename, once);
    if (filename == null || filename === void 0) {
      throw new Error(`Missing include target for ${command}`);
    }
    const resolvedPath = this.resolveIncludePath(filename);
    if (!this.includedFiles.has(resolvedPath)) {
      this.includedFiles.set(resolvedPath, { included: true, guarded: false });
    }
    this.assemblefile(filename, true);
    if (once) {
      debug7("handleInclude once", this.currentFile);
      const fileInfo = this.includedFiles.get(this.currentFile) || { included: true, guarded: false };
      fileInfo.guarded = true;
      this.includedFiles.set(this.currentFile, fileInfo);
    }
  };
  /**
   * Assembles a file, handling include guards and recursion limits.
   * @param {string} filename The filename to assemble.
   * @param {boolean} isInclude Whether the file is being included.
   * @throws {Error} If the recursion limit is exceeded or the file is included again.
   */
  assemblefile = (filename, isInclude) => {
    debug7("assemblefile", filename, isInclude);
    const resolvedPath = this.resolveIncludePath(filename);
    const fileInfo = this.includedFiles.get(resolvedPath);
    if (fileInfo?.guarded) {
      debug7("assemblefile include guard hit, skipping");
      return;
    }
    if (this.includeStack.length >= 512) {
      throw new Error("Recursion limit exceeded (512 levels)");
    }
    if (resolvedPath === this.currentFile || this.includeStack.includes(resolvedPath)) {
      throw new Error(`Recursive include detected for '${resolvedPath}'`);
    }
    const previousFile = this.currentFile;
    this.includeStack.push(previousFile);
    this.recordIncludeEdge(previousFile, resolvedPath);
    try {
      const content = this.fileProvider.readTextFile(resolvedPath, "utf8");
      this.currentFile = resolvedPath;
      if (!this.includedFiles.has(resolvedPath)) {
        this.includedFiles.set(resolvedPath, { included: true, guarded: false });
      } else {
        const info = this.includedFiles.get(resolvedPath);
        info.included = true;
        this.includedFiles.set(resolvedPath, info);
      }
      const includeNode = this.createIncludeNode(resolvedPath, content);
      for (const node of includeNode.commands) {
        this.executeNode(node);
      }
    } catch (error) {
      debug7("assemblefile error \u{1F4A5}", error);
      const message = error instanceof Error ? error.message : JSON.stringify(error) ?? "Unknown error";
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`);
    } finally {
      this.currentFile = this.includeStack.pop() || "";
    }
  };
  /**
   * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
   * @param {NormalizedCommand | string[]} command The normalized command node or legacy words tuple.
   * @throws {Error} If the format is incorrect.
   */
  handleCharacterMapping(command) {
    const words = Array.isArray(command) ? command : command.words;
    debug7("handleCharacterMapping", words);
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const char = words[0].replace(/["']/g, "");
    const value = this.operandResolver.getnum(words[2]);
    this.characterMappings.set(char, value);
  }
  /**
   * Processes a string and maps characters to their corresponding values in `characterMappings`.
   * If a character is not found in `characterMappings`, its charCode is used instead.
   * @param {string} input The string to process.
   * @returns {number[]} An array of numbers representing the mapped characters.
   */
  processStringWithMapping(input) {
    return Array.from(input).map((char) => this.characterMappings.get(char) ?? char.charCodeAt(0));
  }
  /**
   * Begins the collection of loop commands.
   * @param {string} type The type of loop to begin ("for" or "while").
   * @param {string} command The command to begin the loop with.
   */
  beginLoopCollection(type, command) {
    debug7("beginLoopCollection", type, command);
    if (type === "for" && command.includes(":")) {
      const inlineCommands = command.split(":").map((entry) => entry.trim()).filter(Boolean);
      const inlineNodes = this.parseCommandStreamToNodes(inlineCommands, this.currentFile, this.currentLine);
      if (this.collectingLoop && this.currentLoop) {
        for (const node of inlineNodes) {
          this.currentLoop.commands.push(node);
        }
      } else {
        this.executeNodeStream(inlineNodes);
      }
      return;
    }
    const header = this.createLoopCommandNode(command);
    const newLoop = {
      type,
      header,
      conditionNode: type === "while" ? header.parsed.condition?.expression : header.parsed.forLoop?.range,
      rangeNode: header.parsed.forLoop?.range,
      startExpression: header.parsed.forLoop?.start,
      endExpression: header.parsed.forLoop?.end,
      variable: header.parsed.forLoop?.variable,
      commands: [],
      startLine: this.currentLine
    };
    if (type === "for") {
      debug7("beginLoopCollection for loop", command);
      if (newLoop.startExpression && newLoop.endExpression) {
        debug7("beginLoopCollection for loop parsed", newLoop);
        try {
          const startExpr = renderExpressionNode(newLoop.startExpression);
          const endExpr = renderExpressionNode(newLoop.endExpression);
          debug7("beginLoopCollection for loop start", startExpr);
          debug7("beginLoopCollection for loop end", endExpr);
          if (/^-?\d+$/.test(startExpr)) {
            newLoop.start = Number.parseInt(startExpr, 10);
          } else {
            newLoop.start = this.operandResolver.getnum(this.resolvedefines(startExpr));
          }
          if (/^-?\d+$/.test(endExpr)) {
            newLoop.end = Number.parseInt(endExpr, 10);
          } else {
            newLoop.end = this.operandResolver.getnum(this.resolvedefines(endExpr));
          }
        } catch (e) {
          debug7("Could not pre-parse for loop range:", e);
        }
      }
    }
    if (this.collectingLoop && this.currentLoop) {
      this.currentLoop.commands.push(newLoop);
      this.loopStack.push(this.currentLoop);
    }
    this.currentLoop = newLoop;
    this.collectingLoop = true;
    this.loopNestingLevel++;
  }
  /**
   * Ends the collection of loop commands and executes the loop.
   * @param {string} type The type of loop to end ("for" or "while").
   */
  endLoopCollection(type) {
    if (!this.collectingLoop || !this.currentLoop) {
      debug7(`endLoopCollection unexpected end${type} without matching ${type}`);
      return;
    }
    if (this.currentLoop.type !== type) {
      debug7(`endLoopCollection mismatched loop types: expected end${this.currentLoop.type}, got end${type}`);
      return;
    }
    this.currentLoop.endLine = this.currentLine;
    if (this.loopStack.length > 0) {
      this.currentLoop = this.loopStack.pop() || null;
    } else {
      const loopToExecute = this.currentLoop;
      this.currentLoop = null;
      this.collectingLoop = false;
      this.executeLoopBlock(loopToExecute);
    }
    this.loopNestingLevel--;
  }
  /**
   * Executes a complete loop block with all its nested commands.
   * @param {LoopBlock} loopBlock The loop block to execute.
   */
  executeLoopBlock(loopBlock) {
    debug7("executeLoopBlock", loopBlock);
    if (loopBlock.type === "for") {
      this.executeForLoop(loopBlock);
    } else if (loopBlock.type === "while") {
      this.executeWhileLoop(loopBlock);
    }
  }
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
  executeForLoopIterations(forBlock, executeBody) {
    const { variable, start, end } = this.resolveForLoopBounds(forBlock);
    if (!variable || start === void 0 || end === void 0) {
      debug7("executeForLoopIterations missing loop semantics:", forBlock);
      return;
    }
    const originalValue = this.defines.get(variable);
    if (start < end) {
      for (let i = start; i < end; i++) {
        this.defines.set(variable, i.toString());
        executeBody();
      }
    }
    if (originalValue !== void 0) {
      this.defines.set(variable, originalValue);
    } else {
      this.defines.delete(variable);
    }
  }
  executeLoweredLoop(loopBlock) {
    debug7("executeLoweredLoop", loopBlock);
    if (loopBlock.loopType === "for") {
      this.executeLoweredForLoop(loopBlock);
    } else if (loopBlock.loopType === "while") {
      this.executeLoweredWhileLoop(loopBlock);
    }
  }
  /**
   * Executes a for loop block.
   * @param {LoopBlock} forBlock The for loop block to execute.
   */
  executeForLoop(forBlock) {
    debug7("executeForLoop", forBlock);
    this.executeForLoopIterations(forBlock, () => this.executeNodeStream(forBlock.commands));
  }
  executeLoweredForLoop(forBlock) {
    debug7("executeLoweredForLoop", forBlock);
    this.executeForLoopIterations(forBlock, () => this.executeLoweredNodeStream(forBlock.commands));
  }
  /**
   * Executes a while loop block.
   * @param {LoopBlock} whileBlock The while loop block to execute.
   */
  executeWhileLoop(whileBlock) {
    debug7("executeWhileLoop", whileBlock);
    this.executeWhileLoopCommands(
      whileBlock,
      whileBlock.commands,
      (cmd) => "source" in cmd && cmd.kind === "defineCommand" ? getDefineVariable(cmd.command) : null,
      (cmd) => this.executeNodeWithRecovery(cmd)
    );
  }
  executeWhileLoopCommands(whileBlock, commands, getDefineTarget, executeCommand) {
    const conditionNode = whileBlock.conditionNode ?? whileBlock.header?.parsed.condition?.expression;
    if (!conditionNode) {
      debug7("executeWhileLoopCommands missing condition expression", whileBlock);
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
      debug7("executeWhileLoopCommands while loop exceeded maximum iteration limit. Possible infinite loop detected.");
    }
    for (const [varName, value] of originalValues.entries()) {
      if (value !== void 0) {
        debug7(`executeWhileLoopCommands setting ${varName} to ${value}`);
        this.defines.set(varName, value);
      } else {
        debug7(`executeWhileLoopCommands delete entry for ${varName}`);
        this.defines.delete(varName);
      }
    }
  }
  executeLoweredWhileLoop(whileBlock) {
    debug7("executeLoweredWhileLoop", whileBlock);
    this.executeWhileLoopCommands(
      whileBlock,
      whileBlock.commands,
      (cmd) => cmd.kind === "command" && cmd.command.kind === "defineCommand" ? getDefineVariable(cmd.command.command) : null,
      (cmd) => this.executeLoweredNodeWithRecovery(cmd)
    );
  }
  createLoopCommandNode(command, sourceFile = this.currentFile, sourceLine = this.currentLine) {
    return this.frontEndService.createLoopCommandNode(command, sourceFile, sourceLine);
  }
  shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine) {
    return shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine);
  }
  lowerNode(command) {
    return this.commandLoweringService.lowerCommand(command);
  }
  getExecutableNodeSpan(node) {
    if ("source" in node) {
      return node.source.normalizedSpan;
    }
    return node.header?.source.normalizedSpan;
  }
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
  executeNodeWithRecovery(node) {
    this.executeWithAnalysisRecovery(
      node,
      (currentNode) => this.getExecutableNodeSpan(currentNode),
      (currentNode) => this.executeNode(currentNode)
    );
  }
  executeNode(node) {
    if ("source" in node) {
      this.processNormalizedCommand(node);
      return;
    }
    if (node.type === "for" || node.type === "while") {
      this.executeLoopBlock(node);
      return;
    }
    if (node.type === "if") {
      this.executeConditionalNode(node);
      return;
    }
  }
  /**
   * Executes a stream of already-shaped nodes with the supplied recovery-aware dispatcher.
   * @param {TNode[]} nodes The nodes to execute.
   * @param {(node: TNode) => void} executeNode Executes one node.
   */
  executeNodeStreamWithRecovery(nodes, executeNode) {
    for (const node of nodes) {
      executeNode(node);
    }
  }
  executeNodeStream(nodes) {
    this.executeNodeStreamWithRecovery(nodes, (node) => this.executeNodeWithRecovery(node));
  }
  executeLoweredNodeWithRecovery(node) {
    this.executeWithAnalysisRecovery(
      node,
      (currentNode) => this.getLoweredNodeSpan(currentNode),
      (currentNode) => this.executeLoweredNode(currentNode)
    );
  }
  executeLoweredNode(node) {
    if (node.kind === "command") {
      this.processNormalizedCommand(node.command);
      return;
    }
    if (node.kind === "directive") {
      const loweredCommand = node.command;
      if (loweredCommand) {
        this.collectCommandReferences(loweredCommand);
      }
    }
    if (node.kind === "loop") {
      this.executeLoweredLoop(node);
      return;
    }
    if (node.kind === "conditional") {
      this.executeLoweredConditionalNode(node);
      return;
    }
    this.dispatchLoweredNode(node);
  }
  executeLoweredNodeStream(nodes) {
    this.executeNodeStreamWithRecovery(nodes, (node) => this.executeLoweredNodeWithRecovery(node));
  }
  /**
   * Drains and executes any completed nodes still buffered in the incremental parser.
   * This protects re-entrant command sources, such as macro expansion, from leaving
   * finished typed roots stranded until the next top-level line arrives.
   */
  flushCompletedIncrementalNodes() {
    const ready = this.frontEndService.drainCompletedRoots(this.incrementalProgramParseState);
    if (ready.length > 0) {
      this.executeNodeStream(ready);
    }
  }
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
  executeConditionalNode(node) {
    this.executeConditionalBranches(
      node.branches,
      (commands) => this.executeNodeStream(commands)
    );
  }
  executeLoweredConditionalNode(node) {
    this.executeConditionalBranches(
      node.branches,
      (commands) => this.executeLoweredNodeStream(commands)
    );
  }
  parseCommandStreamToNodes(commands, sourceFile = this.currentFile, startLine = this.currentLine) {
    return this.frontEndService.parseCommandStreamToNodes(commands, sourceFile, startLine);
  }
  getOrBuildPassProgram(commands, sourceFile = this.currentFile, startLine = this.currentLine) {
    return this.frontEndService.getOrBuildPassProgram(commands, sourceFile, startLine);
  }
  getMacroDefinitionNode(name) {
    const macro = this.macros.get(name);
    if (!macro) {
      return void 0;
    }
    const body = macro.body.map((entry) => entry);
    return {
      type: "macroDefinition",
      name: macro.name,
      params: [...macro.params],
      variadic: macro.variadic,
      body,
      sourceFile: macro.sourceFile
    };
  }
  createIncludeNode(file, source) {
    return this.frontEndService.createIncludeNode(file, source);
  }
};

// src/lsp/overlay-file-provider.ts
import path2 from "node:path";
var OverlayFileProvider = class {
  /** Open document contents keyed by absolute, normalized path. */
  overlay;
  /** The backing provider used when a path is not in the overlay. */
  base;
  /**
   * Creates an overlay provider.
   * @param {Map<string, string>} [overlay] Initial overlay contents keyed by absolute path.
   * @param {AssemblyFileProvider} [base] Backing provider for disk reads.
   */
  constructor(overlay = /* @__PURE__ */ new Map(), base = new NodeAssemblyFileProvider()) {
    this.overlay = overlay;
    this.base = base;
  }
  /**
   * Resolves a filename to an absolute path, preferring overlay entries.
   * @param {string} filename The filename or relative path to resolve.
   * @param {AssemblyFileResolutionOptions} [options] Resolution context (current file, include paths).
   * @returns {string | undefined} The resolved absolute path, or undefined when not found.
   */
  resolvePath(filename, options = {}) {
    if (!filename) {
      return void 0;
    }
    const normalized = stripWrappingQuotes2(filename);
    const baseResolved = this.base.resolvePath(filename, options);
    if (baseResolved) {
      return baseResolved;
    }
    if (path2.isAbsolute(normalized) && this.overlay.has(normalized)) {
      return normalized;
    }
    for (const candidate of this.candidatePaths(normalized, options)) {
      if (this.overlay.has(candidate)) {
        return candidate;
      }
    }
    return void 0;
  }
  /**
   * Returns stat information, treating overlay entries as readable files.
   * @param {string} filePath The absolute path to stat.
   * @returns {AssemblyFileStat} The stat result.
   */
  stat(filePath) {
    const entry = this.overlay.get(filePath);
    if (entry !== void 0) {
      return {
        exists: true,
        readable: true,
        size: Buffer.byteLength(entry, "utf8")
      };
    }
    return this.base.stat(filePath);
  }
  /**
   * Reads a file as bytes, using overlay content when present.
   * @param {string} filePath The absolute path to read.
   * @returns {Uint8Array} The file bytes.
   */
  readFile(filePath) {
    const entry = this.overlay.get(filePath);
    if (entry !== void 0) {
      return new Uint8Array(Buffer.from(entry, "utf8"));
    }
    return this.base.readFile(filePath);
  }
  /**
   * Reads a file as text, using overlay content when present.
   * @param {string} filePath The absolute path to read.
   * @param {string} [encoding] The text encoding for disk reads.
   * @returns {string} The file text.
   */
  readTextFile(filePath, encoding = "utf8") {
    const entry = this.overlay.get(filePath);
    if (entry !== void 0) {
      return entry;
    }
    return this.base.readTextFile(filePath, encoding);
  }
  /**
   * Builds the candidate absolute paths for a relative filename, mirroring the
   * Node provider's resolution order.
   * @param {string} normalized The unquoted filename.
   * @param {AssemblyFileResolutionOptions} options Resolution context.
   * @returns {string[]} The candidate absolute paths to probe in the overlay.
   */
  candidatePaths(normalized, options) {
    if (path2.isAbsolute(normalized)) {
      return [normalized];
    }
    const baseDirectories = [
      options.macroSourceFile ? path2.dirname(options.macroSourceFile) : void 0,
      options.currentFile ? path2.dirname(options.currentFile) : void 0,
      ...options.includePaths ?? [],
      process.cwd()
    ].filter((entry) => Boolean(entry));
    return baseDirectories.map((directory) => path2.resolve(directory, normalized));
  }
};
function stripWrappingQuotes2(filename) {
  if (filename.startsWith('"') && filename.endsWith('"') || filename.startsWith("'") && filename.endsWith("'") || filename.startsWith("`") && filename.endsWith("`")) {
    return filename.slice(1, -1);
  }
  return filename;
}

// src/lsp/workspace-index.ts
import path3 from "node:path";
var WorkspaceIndex = class {
  /** Open editor buffers keyed by absolute path. */
  overlay = /* @__PURE__ */ new Map();
  /** Per-file analysis buckets keyed by absolute path. */
  fileAnalysis = /* @__PURE__ */ new Map();
  /** Merged include-graph edges across all analysed roots. */
  includeEdges = [];
  /** All symbol definitions across the workspace (for cross-file resolution). */
  allSymbols = [];
  /** All symbol references across the workspace (for find-references). */
  allReferences = [];
  entryPoints;
  includePaths;
  architecture;
  /**
   * Creates a workspace index.
   * @param {WorkspaceIndexOptions} [options] Initial index configuration.
   */
  constructor(options = {}) {
    this.entryPoints = (options.entryPoints ?? []).map((entry) => path3.resolve(entry));
    this.includePaths = options.includePaths ?? ["./"];
    this.architecture = options.architecture ?? "65816";
  }
  /**
   * Updates index configuration and re-analyses the workspace.
   * @param {WorkspaceIndexOptions} options The configuration to apply.
   */
  configure(options) {
    if (options.entryPoints) {
      this.entryPoints = options.entryPoints.map((entry) => path3.resolve(entry));
    }
    if (options.includePaths) {
      this.includePaths = options.includePaths;
    }
    if (options.architecture) {
      this.architecture = options.architecture;
    }
    this.reindex();
  }
  /**
   * Adds or replaces an open editor buffer and re-analyses the workspace.
   * @param {string} file The absolute path of the document.
   * @param {string} content The current document text.
   */
  openDocument(file, content) {
    this.overlay.set(path3.resolve(file), content);
    this.reindex();
  }
  /**
   * Updates the content of an already-open document and re-analyses.
   * @param {string} file The absolute path of the document.
   * @param {string} content The new document text.
   */
  updateDocument(file, content) {
    this.openDocument(file, content);
  }
  /**
   * Removes an open editor buffer (reverting to disk) and re-analyses.
   * @param {string} file The absolute path of the document.
   */
  closeDocument(file) {
    this.overlay.delete(path3.resolve(file));
    this.reindex();
  }
  /**
   * Returns the current text for a file, preferring the open buffer.
   * @param {string} file The absolute path of the file.
   * @returns {string | undefined} The file text, or undefined when unavailable.
   */
  getText(file) {
    return this.overlay.get(path3.resolve(file));
  }
  /**
   * Returns the text for a file from the open buffer, falling back to disk.
   * Used by features that must compute precise ranges in files that may not be
   * open in the editor (for example, cross-file rename targets).
   * @param {string} file The absolute path of the file.
   * @returns {string | undefined} The file text, or undefined when unreadable.
   */
  getFileText(file) {
    const resolved = path3.resolve(file);
    const open = this.overlay.get(resolved);
    if (open !== void 0) {
      return open;
    }
    try {
      const provider = new OverlayFileProvider(this.overlay);
      const stat = provider.stat(resolved);
      if (!stat.exists || !stat.readable) {
        return void 0;
      }
      return provider.readTextFile(resolved);
    } catch {
      return void 0;
    }
  }
  /**
   * Returns the analysis bucket for a file, if it has been analysed.
   * @param {string} file The absolute path of the file.
   * @returns {FileAnalysis | undefined} The per-file analysis, or undefined.
   */
  getFileAnalysis(file) {
    return this.fileAnalysis.get(path3.resolve(file));
  }
  /**
   * Returns diagnostics for a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblyDiagnostic[]} The diagnostics for the file.
   */
  getDiagnostics(file) {
    return this.getFileAnalysis(file)?.diagnostics ?? [];
  }
  /**
   * Returns symbol definitions declared in a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblySymbolDefinition[]} The symbols defined in the file.
   */
  getSymbols(file) {
    return this.getFileAnalysis(file)?.symbols ?? [];
  }
  /**
   * Returns symbol references that occur in a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblySymbolReference[]} The references in the file.
   */
  getReferences(file) {
    return this.getFileAnalysis(file)?.references ?? [];
  }
  /**
   * Returns every symbol definition known across the workspace.
   * @returns {AssemblySymbolDefinition[]} All workspace symbol definitions.
   */
  getAllSymbols() {
    return this.allSymbols;
  }
  /**
   * Returns every symbol reference known across the workspace.
   * @returns {AssemblySymbolReference[]} All workspace symbol references.
   */
  getAllReferences() {
    return this.allReferences;
  }
  /**
   * Returns the merged include-graph edges.
   * @returns {AssemblyIncludeEdge[]} The include edges across all roots.
   */
  getIncludeEdges() {
    return this.includeEdges;
  }
  /**
   * Returns the absolute paths of every file with analysis artifacts.
   * @returns {string[]} The analysed file paths.
   */
  getAnalyzedFiles() {
    return [...this.fileAnalysis.keys()];
  }
  /**
   * Re-runs analysis for every root and rebuilds all per-file buckets.
   * Roots are the configured entry points, or every open document when no
   * entry points are configured.
   */
  reindex() {
    this.fileAnalysis.clear();
    this.includeEdges = [];
    this.allSymbols = [];
    this.allReferences = [];
    const roots = this.resolveRoots();
    const seenEdges = /* @__PURE__ */ new Set();
    for (const root of roots) {
      const content = this.overlay.get(root) ?? this.readDiskRoot(root);
      if (content === void 0) {
        continue;
      }
      const provider = new OverlayFileProvider(this.overlay);
      const assembler = new Assembler(void 0, { fileProvider: provider });
      assembler.includePaths = this.deriveIncludePaths(root);
      assembler.arch = this.architecture;
      let result;
      try {
        result = assembler.analyzeSource(content, root, 0);
      } catch {
        continue;
      }
      this.ingestArtifacts(root, result.diagnostics, result.symbols, result.references);
      for (const edge of result.includeEdges) {
        const key = `${edge.fromFile}\0${edge.toFile}`;
        if (seenEdges.has(key)) {
          continue;
        }
        seenEdges.add(key);
        this.includeEdges.push(edge);
      }
    }
  }
  /**
   * Buckets flat analysis artifacts into their owning files.
   * @param {string} root The root file that produced these artifacts.
   * @param {AssemblyDiagnostic[]} diagnostics The diagnostics to bucket.
   * @param {AssemblySymbolDefinition[]} symbols The symbols to bucket.
   * @param {AssemblySymbolReference[]} references The references to bucket.
   */
  ingestArtifacts(root, diagnostics, symbols, references) {
    for (const diagnostic of diagnostics) {
      this.bucketFor(diagnostic.location.file || root).diagnostics.push(diagnostic);
    }
    for (const symbol of symbols) {
      this.bucketFor(symbol.location.file || root).symbols.push(symbol);
      this.allSymbols.push(symbol);
    }
    for (const reference of references) {
      this.bucketFor(reference.location.file || root).references.push(reference);
      this.allReferences.push(reference);
    }
  }
  /**
   * Returns (creating if needed) the analysis bucket for a file.
   * @param {string} file The absolute path of the file.
   * @returns {FileAnalysis} The mutable analysis bucket.
   */
  bucketFor(file) {
    const resolved = path3.resolve(file);
    let bucket = this.fileAnalysis.get(resolved);
    if (!bucket) {
      bucket = { file: resolved, diagnostics: [], symbols: [], references: [] };
      this.fileAnalysis.set(resolved, bucket);
    }
    return bucket;
  }
  /**
   * Determines the set of root files to analyse.
   * @returns {string[]} The absolute root paths.
   */
  resolveRoots() {
    if (this.entryPoints.length > 0) {
      return [...new Set(this.entryPoints)];
    }
    return [...this.overlay.keys()];
  }
  /**
   * Reads a root file from disk when it is not open in the editor.
   * @param {string} root The absolute root path.
   * @returns {string | undefined} The file text, or undefined when unreadable.
   */
  readDiskRoot(root) {
    try {
      const provider = new OverlayFileProvider(this.overlay);
      const stat = provider.stat(root);
      if (!stat.exists || !stat.readable) {
        return void 0;
      }
      return provider.readTextFile(root);
    } catch {
      return void 0;
    }
  }
  /**
   * Derives the include search paths for a root, always including its directory.
   * @param {string} root The absolute root path.
   * @returns {string[]} The include paths to hand to the assembler.
   */
  deriveIncludePaths(root) {
    const directory = path3.dirname(root);
    return [.../* @__PURE__ */ new Set([directory, ...this.includePaths])];
  }
};

// src/lsp/position-lookup.ts
function locationRange(location) {
  if (location.range) {
    return location.range;
  }
  if (location.span) {
    return sourceSpanToRange(location.span, location.span.line ?? location.line);
  }
  return void 0;
}
function positionInRange(position, range) {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }
  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }
  if (position.line === range.end.line && position.character > range.end.character) {
    return false;
  }
  return true;
}
function referenceAt(references, position) {
  return narrowestMatch(references, position);
}
function symbolAt(symbols, position) {
  return narrowestMatch(symbols, position);
}
function resolveDefinition(reference, allSymbols) {
  const byName = allSymbols.filter((symbol) => symbol.name === reference.name);
  if (byName.length === 0) {
    return [];
  }
  const byKind = byName.filter((symbol) => kindMatches(reference.kind, symbol.kind));
  const candidates = byKind.length > 0 ? byKind : byName;
  if (reference.containerName) {
    const scoped = candidates.filter((symbol) => symbol.containerName === reference.containerName);
    if (scoped.length > 0) {
      return scoped;
    }
  }
  return candidates;
}
function findReferences(name, allReferences, containerName) {
  return allReferences.filter((reference) => reference.name === name && (containerName === void 0 || reference.containerName === containerName));
}
function kindMatches(referenceKind, symbolKind) {
  switch (referenceKind) {
    case "label":
      return symbolKind === "label" || symbolKind === "structMember" || symbolKind === "struct";
    case "define":
      return symbolKind === "define";
    case "macro":
      return symbolKind === "macro";
    case "function":
      return symbolKind === "function" || symbolKind === "macro";
    case "include":
    case "instruction":
      return false;
    case "unknown":
    default:
      return true;
  }
}
function narrowestMatch(located, position) {
  let best;
  let bestWidth = Number.POSITIVE_INFINITY;
  for (const item of located) {
    const range = locationRange(item.location);
    if (!range || !positionInRange(position, range)) {
      continue;
    }
    const width = rangeWidth(range);
    if (width < bestWidth) {
      best = item;
      bestWidth = width;
    }
  }
  return best;
}
function rangeWidth(range) {
  const lineSpan = range.end.line - range.start.line;
  const columnSpan = range.end.character - range.start.character;
  return lineSpan * 1e6 + columnSpan;
}

// src/lsp/directive-catalog.ts
var directiveCatalog = [
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
  { keyword: "incsrc", summary: "Assemble another source file inline.", syntax: 'incsrc "file.asm"', group: "include" },
  { keyword: "include", summary: "Include and assemble another source file.", syntax: 'include "file.asm"', group: "include" },
  { keyword: "includeonce", summary: "Guard the current file against being included more than once.", syntax: "includeonce", group: "include" },
  { keyword: "incbin", summary: "Embed the raw bytes of a binary file.", syntax: 'incbin "file.bin"[,start,length]', group: "include" },
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
  { keyword: "print", summary: "Print a message at assemble time.", syntax: 'print "text"', group: "compat" },
  { keyword: "autoclean", summary: "Auto-clean a previous freespace (asar-compatible).", syntax: "autoclean ...", group: "compat" },
  { keyword: "autoclear", summary: "Auto-clear a previous freespace (asar-compatible).", syntax: "autoclear ...", group: "compat" },
  { keyword: "table", summary: "Load a character mapping table (asar-compatible).", syntax: 'table "file"', group: "compat" },
  { keyword: "includefrom", summary: "Assert the file was included (asar-compatible).", syntax: 'includefrom "file"', group: "compat" },
  { keyword: "asar", summary: "Assert a minimum asar version (compat no-op).", syntax: "asar version", group: "compat" }
];
var directiveByKeyword = new Map(
  directiveCatalog.map((descriptor) => [descriptor.keyword.toLowerCase(), descriptor])
);
function findDirective(keyword) {
  return directiveByKeyword.get(keyword.toLowerCase());
}

// src/lsp/catalog.ts
function findInstruction(mnemonic, architecture) {
  const upper = mnemonic.toUpperCase();
  return getCatalogForArchitecture(architecture).find((entry) => entry.mnemonic === upper);
}
function renderInstructionDocs(descriptor) {
  const lines = [];
  lines.push(`**${descriptor.mnemonic}** \u2014 instruction`);
  if (descriptor.summary) {
    lines.push("", descriptor.summary);
  }
  if (descriptor.modes.length > 0) {
    lines.push("", "Addressing modes:");
    for (const mode of descriptor.modes) {
      const opcode = mode.opcode === void 0 ? "" : ` \`$${mode.opcode.toString(16).padStart(2, "0").toUpperCase()}\``;
      const size = mode.size === void 0 ? "" : ` (${mode.size} bytes)`;
      const example = mode.syntax ? ` \`${descriptor.mnemonic} ${mode.syntax}\`` : ` \`${descriptor.mnemonic}\``;
      lines.push(`- ${mode.mode}:${example}${opcode}${size}`);
    }
  }
  return lines.join("\n");
}
function renderDirectiveDocs(descriptor) {
  return [
    `**${descriptor.keyword}** \u2014 directive`,
    "",
    descriptor.summary,
    "",
    `\`${descriptor.syntax}\``
  ].join("\n");
}
function buildCompletionEntries(architecture) {
  const entries = [];
  for (const instruction2 of getCatalogForArchitecture(architecture)) {
    entries.push({
      label: instruction2.mnemonic,
      kind: "instruction",
      detail: instruction2.summary ?? "instruction",
      documentation: renderInstructionDocs(instruction2)
    });
  }
  for (const directive of directiveCatalog) {
    entries.push({
      label: directive.keyword,
      kind: "directive",
      detail: directive.summary,
      documentation: renderDirectiveDocs(directive)
    });
  }
  return entries;
}

// language-server/src/providers.ts
var import_vscode_languageserver = __toESM(require_main4(), 1);
import { pathToFileURL, fileURLToPath } from "node:url";
import path4 from "node:path";
var semanticTokensLegend = {
  tokenTypes: ["keyword", "function", "variable", "property", "macro", "namespace", "number", "string"],
  tokenModifiers: ["declaration"]
};
var tokenTypeIndex = new Map(
  semanticTokensLegend.tokenTypes.map((type, index2) => [type, index2])
);
var IDENTIFIER_CHAR = /[A-Za-z0-9_.!]/;
function pathToUri(filePath) {
  return pathToFileURL(filePath).toString();
}
function uriToPath(uri) {
  return fileURLToPath(uri);
}
function toRange(range) {
  return import_vscode_languageserver.Range.create(range.start.line, range.start.character, range.end.line, range.end.character);
}
function toDiagnosticSeverity(severity) {
  switch (severity) {
    case "warning":
      return import_vscode_languageserver.DiagnosticSeverity.Warning;
    case "info":
      return import_vscode_languageserver.DiagnosticSeverity.Information;
    case "error":
    default:
      return import_vscode_languageserver.DiagnosticSeverity.Error;
  }
}
function toSymbolKind(kind) {
  switch (kind) {
    case "define":
      return import_vscode_languageserver.SymbolKind.Constant;
    case "macro":
      return import_vscode_languageserver.SymbolKind.Function;
    case "struct":
      return import_vscode_languageserver.SymbolKind.Struct;
    case "structMember":
      return import_vscode_languageserver.SymbolKind.Field;
    case "function":
      return import_vscode_languageserver.SymbolKind.Function;
    case "label":
    default:
      return import_vscode_languageserver.SymbolKind.Variable;
  }
}
function lineFallbackRange(line) {
  const safeLine = Number.isFinite(line) && line >= 0 ? line : 0;
  return import_vscode_languageserver.Range.create(safeLine, 0, safeLine, 0);
}
function splitLines(text) {
  return text.split(/\r?\n/);
}
function preciseRange(index2, file, line, name, fallback) {
  const text = index2.getFileText(file);
  if (!text) {
    return fallback;
  }
  const rawLine = splitLines(text)[line];
  if (rawLine === void 0) {
    return fallback;
  }
  const column = findTokenColumn(rawLine, name);
  if (column < 0) {
    return fallback;
  }
  return import_vscode_languageserver.Range.create(line, column, line, column + name.length);
}
function findTokenColumn(lineText, name) {
  if (!name) {
    return -1;
  }
  const commentIndex = lineText.indexOf(";");
  let from = 0;
  let looseMatch = -1;
  for (; ; ) {
    const index2 = lineText.indexOf(name, from);
    if (index2 < 0) {
      break;
    }
    const inComment = commentIndex >= 0 && index2 > commentIndex;
    if (!inComment) {
      if (looseMatch < 0) {
        looseMatch = index2;
      }
      const before = index2 > 0 ? lineText[index2 - 1] : "";
      const after = index2 + name.length < lineText.length ? lineText[index2 + name.length] : "";
      if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) {
        return index2;
      }
    }
    from = index2 + 1;
  }
  return looseMatch;
}
function wordAt(text, position) {
  const line = splitLines(text)[position.line];
  if (line === void 0) {
    return void 0;
  }
  const wordPattern = /[A-Za-z0-9_.!]+/g;
  let match;
  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return match[0];
    }
  }
  return void 0;
}
function cursorWord(index2, file, position) {
  const text = index2.getFileText(file);
  return text ? wordAt(text, position) : void 0;
}
function cursorReference(index2, file, position, word) {
  const references = index2.getReferences(file);
  const exact = referenceAt(references, position);
  if (exact) {
    return exact;
  }
  if (!word) {
    return void 0;
  }
  return references.find((reference) => reference.name === word && locationRange(reference.location)?.start.line === position.line) ?? references.find((reference) => reference.name === word);
}
function cursorSymbol(index2, file, position, word) {
  const symbols = index2.getSymbols(file);
  const exact = symbolAt(symbols, position);
  if (exact) {
    return exact;
  }
  if (!word) {
    return void 0;
  }
  return symbols.find((symbol) => symbol.name === word && locationRange(symbol.location)?.start.line === position.line) ?? symbols.find((symbol) => symbol.name === word);
}
function diagnosticsFor(index2, file) {
  return index2.getDiagnostics(file).map((diagnostic) => {
    const range = locationRange(diagnostic.location);
    return import_vscode_languageserver.Diagnostic.create(
      range ? toRange(range) : lineFallbackRange(diagnostic.location.line),
      diagnostic.message,
      toDiagnosticSeverity(diagnostic.severity),
      diagnostic.code,
      "snes-asm"
    );
  });
}
function documentSymbolsFor(index2, file) {
  return index2.getSymbols(file).map((symbol) => {
    const lspRange = definitionRange(index2, symbol);
    return import_vscode_languageserver.DocumentSymbol.create(
      symbol.name,
      symbol.containerName,
      toSymbolKind(symbol.kind),
      lspRange,
      lspRange
    );
  });
}
function definitionFor(index2, file, position) {
  const word = cursorWord(index2, file, position);
  const reference = cursorReference(index2, file, position, word);
  if (reference) {
    if (reference.kind === "include") {
      const target = resolveIncludeTarget(index2, file, reference.name);
      if (target) {
        return [import_vscode_languageserver.Location.create(pathToUri(target), import_vscode_languageserver.Range.create(0, 0, 0, 0))];
      }
    }
    const definitions = resolveDefinition(reference, index2.getAllSymbols());
    if (definitions.length > 0) {
      return definitions.map((definition) => definitionToLocation(index2, definition));
    }
  }
  const symbol = cursorSymbol(index2, file, position, word);
  if (symbol) {
    return [definitionToLocation(index2, symbol)];
  }
  if (word) {
    const byName = index2.getAllSymbols().filter((entry) => entry.name === word);
    if (byName.length > 0) {
      return byName.map((definition) => definitionToLocation(index2, definition));
    }
  }
  return [];
}
function referencesFor(index2, file, position, includeDeclaration) {
  const name = identifierNameAt(index2, file, position);
  if (!name) {
    return [];
  }
  const locations = [];
  for (const reference of findReferences(name, index2.getAllReferences())) {
    locations.push(import_vscode_languageserver.Location.create(
      pathToUri(reference.location.file),
      referenceRange(index2, reference)
    ));
  }
  if (includeDeclaration) {
    for (const symbol of index2.getAllSymbols().filter((entry) => entry.name === name)) {
      locations.push(definitionToLocation(index2, symbol));
    }
  }
  return locations;
}
function hoverFor(index2, file, position, text, architecture) {
  const word = wordAt(text, position);
  const reference = cursorReference(index2, file, position, word);
  if (reference?.kind === "instruction") {
    const descriptor = findInstruction(reference.name, architecture);
    if (descriptor) {
      return markdownHover(renderInstructionDocs(descriptor));
    }
  }
  if (reference) {
    const definitions = resolveDefinition(reference, index2.getAllSymbols());
    if (definitions.length > 0) {
      return markdownHover(renderSymbolDocs(definitions[0]));
    }
  }
  const symbol = cursorSymbol(index2, file, position, word);
  if (symbol) {
    return markdownHover(renderSymbolDocs(symbol));
  }
  if (!word) {
    return null;
  }
  const instruction2 = findInstruction(word, architecture);
  if (instruction2) {
    return markdownHover(renderInstructionDocs(instruction2));
  }
  const directive = findDirective(word);
  if (directive) {
    return markdownHover(renderDirectiveDocs(directive));
  }
  return null;
}
function completionsFor(index2, architecture) {
  const items = buildCompletionEntries(architecture).map((entry) => ({
    label: entry.label,
    kind: entry.kind === "instruction" ? import_vscode_languageserver.CompletionItemKind.Keyword : import_vscode_languageserver.CompletionItemKind.Function,
    detail: entry.detail,
    documentation: { kind: import_vscode_languageserver.MarkupKind.Markdown, value: entry.documentation }
  }));
  const seen = /* @__PURE__ */ new Set();
  for (const symbol of index2.getAllSymbols()) {
    const key = `${symbol.kind}\0${symbol.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      label: symbol.name,
      kind: symbolCompletionKind(symbol.kind),
      detail: symbol.containerName ? `${symbol.kind} in ${symbol.containerName}` : symbol.kind
    });
  }
  return items;
}
function signatureHelpFor(lineText, architecture) {
  const leading = lineText.trim().split(/\s+/)[0];
  if (!leading) {
    return null;
  }
  const instruction2 = findInstruction(leading, architecture);
  if (instruction2) {
    const signatures = instruction2.modes.map((mode) => import_vscode_languageserver.SignatureInformation.create(
      `${instruction2.mnemonic} ${mode.syntax}`.trim(),
      `${mode.mode}${instruction2.summary ? ` \u2014 ${instruction2.summary}` : ""}`
    ));
    return { signatures, activeSignature: 0, activeParameter: 0 };
  }
  const directive = findDirective(leading);
  if (directive) {
    return {
      signatures: [import_vscode_languageserver.SignatureInformation.create(directive.syntax, directive.summary)],
      activeSignature: 0,
      activeParameter: 0
    };
  }
  return null;
}
function prepareRenameFor(index2, file, position) {
  const word = cursorWord(index2, file, position);
  const reference = cursorReference(index2, file, position, word);
  if (reference) {
    return referenceRange(index2, reference);
  }
  const symbol = cursorSymbol(index2, file, position, word);
  if (symbol) {
    return definitionRange(index2, symbol);
  }
  return null;
}
function renameEditsFor(index2, file, position, newName) {
  const name = identifierNameAt(index2, file, position);
  if (!name) {
    return null;
  }
  const editsByUri = /* @__PURE__ */ new Map();
  const pushEdit = (uri, range) => {
    const edits = editsByUri.get(uri) ?? [];
    edits.push(import_vscode_languageserver.TextEdit.replace(range, newName));
    editsByUri.set(uri, edits);
  };
  for (const symbol of index2.getAllSymbols().filter((entry) => entry.name === name)) {
    pushEdit(pathToUri(symbol.location.file), definitionRange(index2, symbol));
  }
  for (const reference of findReferences(name, index2.getAllReferences())) {
    pushEdit(pathToUri(reference.location.file), referenceRange(index2, reference));
  }
  if (editsByUri.size === 0) {
    return null;
  }
  return { changes: Object.fromEntries(editsByUri) };
}
function semanticTokensFor(index2, file) {
  const tokens = [];
  const push = (range, type) => {
    if (range.start.line !== range.end.line) {
      return;
    }
    const length = Math.max(range.end.character - range.start.character, 0);
    if (length === 0) {
      return;
    }
    tokens.push({ line: range.start.line, char: range.start.character, length, type });
  };
  for (const symbol of index2.getSymbols(file)) {
    push(definitionRange(index2, symbol), symbolTokenType(symbol.kind));
  }
  for (const reference of index2.getReferences(file)) {
    push(referenceRange(index2, reference), referenceTokenType(reference.kind));
  }
  tokens.sort((a, b) => a.line - b.line || a.char - b.char);
  const builder = new import_vscode_languageserver.SemanticTokensBuilder();
  let previous;
  for (const token of tokens) {
    if (previous && previous.line === token.line && previous.char === token.char) {
      continue;
    }
    builder.push(token.line, token.char, token.length, token.type, 0);
    previous = token;
  }
  return builder.build();
}
function definitionRange(index2, symbol) {
  const fallbackRange = locationRange(symbol.location);
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(symbol.location.line);
  const line = fallbackRange?.start.line ?? symbol.location.line;
  return preciseRange(index2, symbol.location.file, line, symbol.name, fallback);
}
function referenceRange(index2, reference) {
  const fallbackRange = locationRange(reference.location);
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(reference.location.line);
  const line = fallbackRange?.start.line ?? reference.location.line;
  return preciseRange(index2, reference.location.file, line, reference.name, fallback);
}
function definitionToLocation(index2, symbol) {
  return import_vscode_languageserver.Location.create(pathToUri(symbol.location.file), definitionRange(index2, symbol));
}
function resolveIncludeTarget(index2, file, target) {
  const normalizedTarget = target.replace(/\\/g, "/");
  const base = path4.basename(normalizedTarget);
  const edges = index2.getIncludeEdges().filter((edge) => edge.fromFile === file);
  const match = edges.find((edge) => edge.toFile === normalizedTarget || path4.basename(edge.toFile) === base);
  return match?.toFile;
}
function identifierNameAt(index2, file, position) {
  const word = cursorWord(index2, file, position);
  const reference = cursorReference(index2, file, position, word);
  if (reference) {
    return reference.name;
  }
  const symbol = cursorSymbol(index2, file, position, word);
  if (symbol) {
    return symbol.name;
  }
  return word;
}
function renderSymbolDocs(symbol) {
  const lines = [`**${symbol.name}** \u2014 ${symbol.kind}`];
  if (symbol.containerName) {
    lines.push("", `In \`${symbol.containerName}\``);
  }
  if (symbol.value !== void 0) {
    const value = typeof symbol.value === "number" ? `$${symbol.value.toString(16).toUpperCase()}` : symbol.value;
    lines.push("", `Value: \`${value}\``);
  }
  lines.push("", `Defined in \`${path4.basename(symbol.location.file)}\``);
  return lines.join("\n");
}
function markdownHover(value) {
  return { contents: { kind: import_vscode_languageserver.MarkupKind.Markdown, value } };
}
function symbolCompletionKind(kind) {
  switch (kind) {
    case "define":
      return import_vscode_languageserver.CompletionItemKind.Constant;
    case "macro":
    case "function":
      return import_vscode_languageserver.CompletionItemKind.Function;
    case "struct":
      return import_vscode_languageserver.CompletionItemKind.Struct;
    case "structMember":
      return import_vscode_languageserver.CompletionItemKind.Field;
    case "label":
    default:
      return import_vscode_languageserver.CompletionItemKind.Variable;
  }
}
function symbolTokenType(kind) {
  switch (kind) {
    case "define":
      return tokenTypeIndex.get("property") ?? 0;
    case "macro":
    case "function":
      return tokenTypeIndex.get("macro") ?? 0;
    case "struct":
      return tokenTypeIndex.get("namespace") ?? 0;
    case "label":
    case "structMember":
    default:
      return tokenTypeIndex.get("variable") ?? 0;
  }
}
function referenceTokenType(kind) {
  switch (kind) {
    case "instruction":
      return tokenTypeIndex.get("function") ?? 0;
    case "define":
      return tokenTypeIndex.get("property") ?? 0;
    case "macro":
      return tokenTypeIndex.get("macro") ?? 0;
    case "function":
      return tokenTypeIndex.get("function") ?? 0;
    case "include":
      return tokenTypeIndex.get("string") ?? 0;
    case "label":
    case "unknown":
    default:
      return tokenTypeIndex.get("variable") ?? 0;
  }
}

// language-server/src/server.ts
var connection = (0, import_node.createConnection)(import_node.ProposedFeatures.all);
var documents = new import_node.TextDocuments(TextDocument);
var defaultSettings = {
  entryPoints: [],
  includePaths: ["./"],
  architecture: "65816"
};
var settings = { ...defaultSettings };
var hasConfigurationCapability = false;
var index = new WorkspaceIndex(settings);
var reindexTimer;
function scheduleReindex() {
  if (reindexTimer) {
    clearTimeout(reindexTimer);
  }
  reindexTimer = setTimeout(() => {
    reindexTimer = void 0;
    index.reindex();
    publishAllDiagnostics();
  }, 150);
}
function publishAllDiagnostics() {
  for (const document of documents.all()) {
    const file = uriToPath(document.uri);
    connection.sendDiagnostics({ uri: document.uri, diagnostics: diagnosticsFor(index, file) });
  }
}
connection.onInitialize((params) => {
  hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);
  applyInitializationOptions(params);
  return {
    capabilities: {
      textDocumentSync: import_node.TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: [".", "!", "$"] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      signatureHelpProvider: { triggerCharacters: [" ", ","] },
      codeActionProvider: { codeActionKinds: [import_node.CodeActionKind.QuickFix] },
      executeCommandProvider: { commands: ["snesAsm.build"] },
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true
      }
    }
  };
});
function buildRom(file, outputPath, targetRomPath) {
  try {
    const overlay = /* @__PURE__ */ new Map();
    for (const document of documents.all()) {
      overlay.set(uriToPath(document.uri), document.getText());
    }
    const provider = new OverlayFileProvider(overlay);
    let targetRom;
    if (targetRomPath) {
      targetRom = new Uint8Array(fs3.readFileSync(targetRomPath));
    }
    const source = provider.readTextFile(file);
    const assembler = new Assembler(targetRom, { fileProvider: provider });
    assembler.setIncludePaths([path5.dirname(file), ...settings.includePaths]);
    assembler.setCurrentFile(file);
    assembler.arch = settings.architecture;
    const program = assembler.buildProgramModel(source, file, 0);
    assembler.assembleProgram(program);
    const output = assembler.getBinaryOutput();
    fs3.mkdirSync(path5.dirname(outputPath), { recursive: true });
    fs3.writeFileSync(outputPath, Buffer.from(output));
    return { ok: true, outputPath, bytes: output.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
function defaultOutputPath(file) {
  const parsed = path5.parse(file);
  return path5.join(parsed.dir, `${parsed.name}.sfc`);
}
connection.onExecuteCommand((params) => {
  if (params.command !== "snesAsm.build") {
    return void 0;
  }
  const args = params.arguments ?? [];
  const uriOrPath = args[0];
  if (!uriOrPath) {
    return { ok: false, message: "No file provided to build." };
  }
  const file = uriOrPath.startsWith("file:") ? uriToPath(uriOrPath) : uriOrPath;
  const outputPath = args[1] ? args[1].startsWith("file:") ? uriToPath(args[1]) : args[1] : defaultOutputPath(file);
  const targetRomPath = args[2] ? args[2].startsWith("file:") ? uriToPath(args[2]) : args[2] : void 0;
  return buildRom(file, outputPath, targetRomPath);
});
connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(import_node.DidChangeConfigurationNotification.type, void 0).catch(() => {
    });
    void refreshConfiguration();
  }
});
function applyInitializationOptions(params) {
  const options = params.initializationOptions ?? {};
  const roots = (params.workspaceFolders ?? []).map((folder) => uriToPath(folder.uri));
  settings = {
    entryPoints: (options.entryPoints ?? []).map((entry) => resolveAgainst(roots, entry)),
    includePaths: options.includePaths ?? defaultSettings.includePaths,
    architecture: options.architecture ?? defaultSettings.architecture
  };
  index.configure(settings);
}
function resolveAgainst(roots, entry) {
  if (roots.length === 0) {
    return entry;
  }
  return entry.startsWith("/") ? entry : `${roots[0]}/${entry}`;
}
async function refreshConfiguration() {
  try {
    const config = await connection.workspace.getConfiguration("snesAsm");
    if (config && typeof config === "object") {
      const next = config;
      settings = {
        entryPoints: next.entryPoints ?? settings.entryPoints,
        includePaths: next.includePaths ?? settings.includePaths,
        architecture: next.architecture ?? settings.architecture
      };
      index.configure(settings);
      publishAllDiagnostics();
    }
  } catch {
  }
}
connection.onDidChangeConfiguration(() => {
  void refreshConfiguration();
});
documents.onDidOpen((event) => {
  index.openDocument(uriToPath(event.document.uri), event.document.getText());
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: diagnosticsFor(index, uriToPath(event.document.uri))
  });
});
documents.onDidChangeContent((event) => {
  index.updateDocument(uriToPath(event.document.uri), event.document.getText());
  scheduleReindex();
});
documents.onDidClose((event) => {
  index.closeDocument(uriToPath(event.document.uri));
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});
connection.onCompletion(() => completionsFor(index, settings.architecture));
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  return hoverFor(index, uriToPath(params.textDocument.uri), params.position, document.getText(), settings.architecture);
});
connection.onDefinition((params) => definitionFor(index, uriToPath(params.textDocument.uri), params.position));
connection.onReferences((params) => referencesFor(
  index,
  uriToPath(params.textDocument.uri),
  params.position,
  params.context.includeDeclaration
));
connection.onDocumentSymbol((params) => documentSymbolsFor(index, uriToPath(params.textDocument.uri)));
connection.onWorkspaceSymbol((params) => {
  const query = params.query.toLowerCase();
  const results = [];
  for (const file of index.getAnalyzedFiles()) {
    for (const symbol of documentSymbolsFor(index, file)) {
      if (!query || symbol.name.toLowerCase().includes(query)) {
        results.push({
          name: symbol.name,
          kind: symbol.kind,
          location: { uri: pathToUri(file), range: symbol.selectionRange },
          containerName: symbol.detail
        });
      }
    }
  }
  return results;
});
connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  const lineStart = { line: params.position.line, character: 0 };
  const lineText = document.getText({ start: lineStart, end: params.position });
  return signatureHelpFor(lineText, settings.architecture);
});
connection.onPrepareRename((params) => prepareRenameFor(index, uriToPath(params.textDocument.uri), params.position));
connection.onRenameRequest((params) => renameEditsFor(
  index,
  uriToPath(params.textDocument.uri),
  params.position,
  params.newName
));
connection.onCodeAction((params) => {
  const file = uriToPath(params.textDocument.uri);
  const actions = [];
  for (const diagnostic of params.context.diagnostics) {
    if (diagnostic.code === "ASSEMBLY_ERROR" || typeof diagnostic.code === "string") {
      actions.push(import_node.CodeAction.create(
        `Review: ${diagnostic.message}`,
        import_node.CodeActionKind.QuickFix
      ));
    }
  }
  void file;
  return actions;
});
connection.languages.semanticTokens.on((params) => semanticTokensFor(index, uriToPath(params.textDocument.uri)));
documents.listen(connection);
connection.listen();

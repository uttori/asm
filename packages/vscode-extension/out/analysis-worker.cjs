"use strict";
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
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/disassembler/src/asset-codec.ts
var init_asset_codec = __esm({
  "packages/disassembler/src/asset-codec.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/asset-codecs/common.ts
var objectValue, optionsFor, stringOption, booleanOption, integerOption, byteOrderOption, readExactAssetBytes, readAssetBytes, resolveCountAndSize, readInteger, writeInteger, decodedObject, numberArray, byteArray, defaultAssetPath, jsonFile;
var init_common = __esm({
  "packages/disassembler/src/asset-codecs/common.ts"() {
    "use strict";
    objectValue = (value, label) => {
      if (value === void 0 || value === null || Array.isArray(value) || typeof value !== "object") {
        if (value === void 0) return {};
        throw new Error(`${label} must be an object.`);
      }
      return value;
    };
    optionsFor = (context) => objectValue(context.request.options, `Asset '${context.request.id}' options`);
    stringOption = (options, key2, fallback) => {
      const value = options[key2];
      if (value === void 0) return fallback;
      if (typeof value !== "string") throw new Error(`Asset option '${key2}' must be a string.`);
      return value;
    };
    booleanOption = (options, key2, fallback = false) => {
      const value = options[key2];
      if (value === void 0) return fallback;
      if (typeof value !== "boolean") throw new Error(`Asset option '${key2}' must be boolean.`);
      return value;
    };
    integerOption = (options, key2, settings6 = {}) => {
      const value = options[key2] ?? settings6.fallback;
      if (value === void 0) return void 0;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || settings6.minimum !== void 0 && value < settings6.minimum || settings6.maximum !== void 0 && value > settings6.maximum) {
        throw new Error(`Asset option '${key2}' is outside its integer bounds.`);
      }
      return value;
    };
    byteOrderOption = (options) => {
      const value = stringOption(options, "endian", "little");
      if (value !== "little" && value !== "big") {
        throw new Error("Asset option 'endian' must be 'little' or 'big'.");
      }
      return value;
    };
    readExactAssetBytes = (context, size = context.inspection.size) => {
      return readAssetBytes(context, size);
    };
    readAssetBytes = (context, size) => {
      const bytes = context.source.read(context.request.sourceOffset, size);
      if (!bytes) throw new Error(`Asset '${context.request.id}' source range is unreadable.`);
      return bytes;
    };
    resolveCountAndSize = (context, unitSize, options = optionsFor(context)) => {
      if (!Number.isSafeInteger(unitSize) || unitSize <= 0) {
        throw new Error("Asset unit size must be a positive safe integer.");
      }
      const configuredCount = integerOption(options, "count", { minimum: 1 });
      const requestedLength = context.request.length;
      if (configuredCount === void 0 && requestedLength === void 0) {
        throw new Error(`Asset '${context.request.id}' requires either length or option 'count'.`);
      }
      if (requestedLength !== void 0 && requestedLength % unitSize !== 0) {
        throw new Error(
          `Asset '${context.request.id}' length ${requestedLength} is not divisible by ${unitSize}.`
        );
      }
      const count = configuredCount ?? requestedLength / unitSize;
      const size = count * unitSize;
      if (!Number.isSafeInteger(size))
        throw new Error(`Asset '${context.request.id}' size overflowed.`);
      if (requestedLength !== void 0 && requestedLength !== size) {
        throw new Error(
          `Asset '${context.request.id}' count ${count} requires ${size} bytes, not ${requestedLength}.`
        );
      }
      return { count, size };
    };
    readInteger = (bytes, offset, width2, endian, signed2 = false) => {
      let value = 0;
      for (let index = 0; index < width2; index++) {
        const byteIndex = endian === "little" ? offset + index : offset + width2 - index - 1;
        value += (bytes[byteIndex] ?? 0) * 2 ** (index * 8);
      }
      const modulus = 2 ** (width2 * 8);
      return signed2 && value >= modulus / 2 ? value - modulus : value;
    };
    writeInteger = (bytes, offset, width2, endian, value, signed2 = false) => {
      const modulus = 2 ** (width2 * 8);
      const minimum = signed2 ? -modulus / 2 : 0;
      const maximum = signed2 ? modulus / 2 - 1 : modulus - 1;
      if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(
          `Integer ${String(value)} does not fit ${signed2 ? "signed" : "unsigned"} ${width2}-byte storage.`
        );
      }
      let remaining = value < 0 ? value + modulus : value;
      for (let index = 0; index < width2; index++) {
        const byteIndex = endian === "little" ? offset + index : offset + width2 - index - 1;
        bytes[byteIndex] = remaining % 256;
        remaining = Math.floor(remaining / 256);
      }
    };
    decodedObject = (value, owner) => objectValue(value, `Decoded asset '${owner}'`);
    numberArray = (value, label) => {
      if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
      return value.map((entry) => {
        if (typeof entry !== "number" || !Number.isSafeInteger(entry)) {
          throw new Error(`${label} must contain only safe integers.`);
        }
        return entry;
      });
    };
    byteArray = (value, label) => {
      const values = numberArray(value, label);
      if (values.some((entry) => entry < 0 || entry > 255)) {
        throw new Error(`${label} must contain only bytes in the range 0..255.`);
      }
      return values;
    };
    defaultAssetPath = (assetId, extension) => `assets/${encodeURIComponent(assetId)}.${extension}`;
    jsonFile = (path9, value) => ({
      path: path9,
      mediaType: "application/json",
      bytes: new TextEncoder().encode(`${JSON.stringify(value, void 0, 2)}
`)
    });
  }
});

// packages/disassembler/src/asset-codecs/index-table.ts
var INDEX_TABLE_ASSET_CODEC_ID, settings, indexesFor, referencesFor, indexTableAssetCodec;
var init_index_table = __esm({
  "packages/disassembler/src/asset-codecs/index-table.ts"() {
    "use strict";
    init_common();
    INDEX_TABLE_ASSET_CODEC_ID = "uttori.asset.index-table";
    settings = (context) => {
      const options = optionsFor(context);
      const width2 = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 1 });
      const endian = byteOrderOption(options);
      const baseIndex = integerOption(options, "baseIndex", { fallback: 0 });
      const nullValue = integerOption(options, "nullValue", {
        minimum: 0,
        maximum: 2 ** (width2 * 8) - 1
      });
      const { count, size } = resolveCountAndSize(context, width2, options);
      if (!Array.isArray(options.targets)) {
        throw new Error("Index-table option 'targets' must be an array.");
      }
      const indexes = /* @__PURE__ */ new Set();
      const targets = options.targets.map((value, position) => {
        const target = objectValue(value, `Index target ${position}`);
        const index = integerOption(target, "index", { minimum: 0 });
        const id = stringOption(target, "id");
        const addressSpace = stringOption(target, "addressSpace");
        const address3 = integerOption(target, "address", { minimum: 0 });
        if (index === void 0 || !id || !addressSpace || address3 === void 0) {
          throw new Error(`Index target ${position} is incomplete.`);
        }
        if (indexes.has(index)) throw new Error(`Index target ${index} is duplicated.`);
        indexes.add(index);
        return { index, id, addressSpace, address: address3 };
      });
      return { options, width: width2, endian, baseIndex, nullValue, count, size, targets };
    };
    indexesFor = (context) => {
      const resolved = settings(context);
      const bytes = readAssetBytes(context, resolved.size);
      const indexes = Array.from({ length: resolved.count }, (_, index) => {
        const raw = readInteger(bytes, index * resolved.width, resolved.width, resolved.endian);
        return resolved.nullValue !== void 0 && raw === resolved.nullValue ? null : raw + resolved.baseIndex;
      });
      return { settings: resolved, indexes };
    };
    referencesFor = (entries3) => {
      const targets = new Map(entries3.settings.targets.map((target) => [target.index, target]));
      return entries3.indexes.flatMap((index, position) => {
        if (index === null) return [];
        const target = targets.get(index);
        return target ? [
          {
            id: `entry-${position.toString().padStart(4, "0")}`,
            kind: "index",
            addressSpace: target.addressSpace,
            address: target.address,
            width: entries3.settings.width,
            targetAssetId: target.id,
            detail: `Index ${index}`
          }
        ] : [];
      });
    };
    indexTableAssetCodec = Object.freeze({
      id: INDEX_TABLE_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const entries3 = indexesFor(context);
        return {
          size: entries3.settings.size,
          references: referencesFor(entries3),
          metadata: {
            count: entries3.settings.count,
            width: entries3.settings.width,
            endian: entries3.settings.endian,
            baseIndex: entries3.settings.baseIndex,
            unresolvedIndexes: entries3.indexes.filter(
              (index) => index !== null && !entries3.settings.targets.some((target) => target.index === index)
            )
          }
        };
      },
      decode: (context) => {
        const entries3 = indexesFor(context);
        const value = { kind: "index-table", indexes: entries3.indexes };
        const path9 = stringOption(
          entries3.settings.options,
          "path",
          defaultAssetPath(context.request.id, "json")
        );
        return { value, files: [jsonFile(path9, value)] };
      },
      encode: (context) => {
        const resolved = settings(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        if (!Array.isArray(value.indexes) || value.indexes.length !== resolved.count) {
          throw new Error(`Index asset '${context.request.id}' requires ${resolved.count} indexes.`);
        }
        const bytes = new Uint8Array(resolved.size);
        value.indexes.forEach((index, position) => {
          let raw;
          if (index === null) {
            if (resolved.nullValue === void 0) {
              throw new Error(`Index asset '${context.request.id}' has null without a nullValue.`);
            }
            raw = resolved.nullValue;
          } else {
            if (typeof index !== "number" || !Number.isSafeInteger(index)) {
              throw new Error(`Index asset '${context.request.id}' indexes must be integers or null.`);
            }
            raw = index - resolved.baseIndex;
          }
          writeInteger(bytes, position * resolved.width, resolved.width, resolved.endian, raw);
        });
        return bytes;
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/pointer-table.ts
var POINTER_TABLE_ASSET_CODEC_ID, settings2, entriesFor, referencesFor2, pointerTableAssetCodec;
var init_pointer_table = __esm({
  "packages/disassembler/src/asset-codecs/pointer-table.ts"() {
    "use strict";
    init_common();
    POINTER_TABLE_ASSET_CODEC_ID = "uttori.asset.pointer-table";
    settings2 = (context) => {
      const options = optionsFor(context);
      const width2 = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 2 });
      const endian = byteOrderOption(options);
      const base = integerOption(options, "base", { fallback: 0 });
      const scale = integerOption(options, "scale", { minimum: 1, fallback: 1 });
      const nullValue = integerOption(options, "nullValue", {
        minimum: 0,
        maximum: 2 ** (width2 * 8) - 1
      });
      const addressSpace = stringOption(options, "addressSpace", context.request.addressSpace);
      if (addressSpace === "") throw new Error("Pointer target address space cannot be empty.");
      const { count, size } = resolveCountAndSize(context, width2, options);
      const targetIdsValue = options.targetAssetIds;
      let targetAssetIds = [];
      if (targetIdsValue !== void 0) {
        if (!Array.isArray(targetIdsValue) || targetIdsValue.length !== count) {
          throw new Error("Pointer option 'targetAssetIds' must match the pointer count.");
        }
        targetAssetIds = targetIdsValue.map((value) => {
          if (value !== null && typeof value !== "string") {
            throw new Error("Pointer target asset ids must be strings or null.");
          }
          return value;
        });
      }
      return {
        options,
        width: width2,
        endian,
        base,
        scale,
        nullValue,
        addressSpace,
        count,
        size,
        targetAssetIds
      };
    };
    entriesFor = (context) => {
      const resolved = settings2(context);
      const bytes = readAssetBytes(context, resolved.size);
      const rawValues = Array.from(
        { length: resolved.count },
        (_, index) => readInteger(bytes, index * resolved.width, resolved.width, resolved.endian)
      );
      const addresses2 = rawValues.map((raw) => {
        if (resolved.nullValue !== void 0 && raw === resolved.nullValue) return null;
        const address3 = resolved.base + raw * resolved.scale;
        if (!Number.isSafeInteger(address3) || address3 < 0) {
          throw new Error(`Pointer asset '${context.request.id}' produced an invalid address.`);
        }
        return address3;
      });
      return { settings: resolved, rawValues, addresses: addresses2 };
    };
    referencesFor2 = (entries3) => entries3.addresses.flatMap(
      (address3, index) => address3 === null ? [] : [
        {
          id: `entry-${index.toString().padStart(4, "0")}`,
          kind: "pointer",
          addressSpace: entries3.settings.addressSpace,
          address: address3,
          width: entries3.settings.width,
          ...entries3.settings.targetAssetIds[index] ? { targetAssetId: entries3.settings.targetAssetIds[index] } : {}
        }
      ]
    );
    pointerTableAssetCodec = Object.freeze({
      id: POINTER_TABLE_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const entries3 = entriesFor(context);
        return {
          size: entries3.settings.size,
          references: referencesFor2(entries3),
          metadata: {
            count: entries3.settings.count,
            width: entries3.settings.width,
            endian: entries3.settings.endian,
            base: entries3.settings.base,
            scale: entries3.settings.scale,
            ...entries3.settings.nullValue === void 0 ? {} : { nullValue: entries3.settings.nullValue }
          }
        };
      },
      decode: (context) => {
        const entries3 = entriesFor(context);
        const value = {
          kind: "pointer-table",
          addresses: entries3.addresses,
          rawValues: entries3.rawValues
        };
        const path9 = stringOption(
          entries3.settings.options,
          "path",
          defaultAssetPath(context.request.id, "json")
        );
        return { value, files: [jsonFile(path9, value)] };
      },
      encode: (context) => {
        const resolved = settings2(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        if (!Array.isArray(value.addresses) || value.addresses.length !== resolved.count) {
          throw new Error(
            `Pointer asset '${context.request.id}' requires ${resolved.count} addresses.`
          );
        }
        const bytes = new Uint8Array(resolved.size);
        value.addresses.forEach((address3, index) => {
          let raw;
          if (address3 === null) {
            if (resolved.nullValue === void 0) {
              throw new Error(`Pointer asset '${context.request.id}' has null without a nullValue.`);
            }
            raw = resolved.nullValue;
          } else {
            if (typeof address3 !== "number" || !Number.isSafeInteger(address3)) {
              throw new Error(
                `Pointer asset '${context.request.id}' addresses must be integers or null.`
              );
            }
            const relative2 = address3 - resolved.base;
            if (relative2 < 0 || relative2 % resolved.scale !== 0) {
              throw new Error(`Pointer address ${address3} is not representable by its base and scale.`);
            }
            raw = relative2 / resolved.scale;
          }
          writeInteger(bytes, index * resolved.width, resolved.width, resolved.endian, raw);
        });
        return bytes;
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/raw.ts
var import_node_crypto, RAW_ASSET_CODEC_ID, rawAssetCodec;
var init_raw = __esm({
  "packages/disassembler/src/asset-codecs/raw.ts"() {
    "use strict";
    import_node_crypto = require("node:crypto");
    init_common();
    RAW_ASSET_CODEC_ID = "uttori.asset.raw";
    rawAssetCodec = Object.freeze({
      id: RAW_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: ({ request: request2 }) => {
        if (request2.length === void 0) {
          throw new Error(`Raw asset '${request2.id}' requires an exact length.`);
        }
        return { size: request2.length, metadata: { sourceForm: "incbin" } };
      },
      decode: (context) => {
        const bytes = readExactAssetBytes(context);
        const options = optionsFor(context);
        const path9 = stringOption(options, "path", defaultAssetPath(context.request.id, "bin"));
        const mediaType = stringOption(options, "mediaType", "application/octet-stream");
        return {
          value: {
            kind: "raw",
            bytes: [...bytes],
            sha256: (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex")
          },
          files: [{ path: path9, mediaType, bytes }]
        };
      },
      encode: ({ decoded, request: request2 }) => {
        const value = decodedObject(decoded.value, request2.id);
        return Uint8Array.from(byteArray(value.bytes, `Raw asset '${request2.id}' bytes`));
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/scalar-array.ts
var SCALAR_ARRAY_ASSET_CODEC_ID, settings3, scalarArrayAssetCodec;
var init_scalar_array = __esm({
  "packages/disassembler/src/asset-codecs/scalar-array.ts"() {
    "use strict";
    init_common();
    SCALAR_ARRAY_ASSET_CODEC_ID = "uttori.asset.scalar-array";
    settings3 = (context) => {
      const options = optionsFor(context);
      const width2 = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 1 });
      const endian = byteOrderOption(options);
      const signed2 = booleanOption(options, "signed");
      const { count, size } = resolveCountAndSize(context, width2, options);
      return { options, width: width2, endian, signed: signed2, count, size };
    };
    scalarArrayAssetCodec = Object.freeze({
      id: SCALAR_ARRAY_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const { width: width2, endian, signed: signed2, count, size } = settings3(context);
        return { size, metadata: { width: width2, endian, signed: signed2, count } };
      },
      decode: (context) => {
        const { options, width: width2, endian, signed: signed2, count } = settings3(context);
        const bytes = readExactAssetBytes(context);
        const values = Array.from(
          { length: count },
          (_, index) => readInteger(bytes, index * width2, width2, endian, signed2)
        );
        const value = { kind: "scalar-array", width: width2, endian, signed: signed2, values };
        const path9 = stringOption(options, "path", defaultAssetPath(context.request.id, "json"));
        return { value, files: [jsonFile(path9, value)] };
      },
      encode: (context) => {
        const { width: width2, endian, signed: signed2, count, size } = settings3(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        const values = numberArray(value.values, `Scalar asset '${context.request.id}' values`);
        if (values.length !== count) {
          throw new Error(`Scalar asset '${context.request.id}' requires exactly ${count} values.`);
        }
        const bytes = new Uint8Array(size);
        values.forEach(
          (entry, index) => writeInteger(bytes, index * width2, width2, endian, entry, signed2)
        );
        return bytes;
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/struct-array.ts
var STRUCT_ARRAY_ASSET_CODEC_ID, parseFields, settings4, readBits, writeBits, structArrayAssetCodec;
var init_struct_array = __esm({
  "packages/disassembler/src/asset-codecs/struct-array.ts"() {
    "use strict";
    init_common();
    STRUCT_ARRAY_ASSET_CODEC_ID = "uttori.asset.struct-array";
    parseFields = (options) => {
      const input = options.fields;
      if (!Array.isArray(input) || input.length === 0) {
        throw new Error("Struct asset option 'fields' must be a non-empty array.");
      }
      const defaultEndian = byteOrderOption(options);
      const names = /* @__PURE__ */ new Set();
      const fields = input.map((entry, index) => {
        const definition = objectValue(entry, `Struct field ${index}`);
        const name = stringOption(definition, "name");
        if (!name) throw new Error(`Struct field ${index} requires a non-empty name.`);
        if (names.has(name)) throw new Error(`Struct field name '${name}' is duplicated.`);
        names.add(name);
        const signed2 = booleanOption(definition, "signed");
        const bitOffset = integerOption(definition, "bitOffset", { minimum: 0 });
        const bits = integerOption(definition, "bits", { minimum: 1, maximum: 32 });
        if (bitOffset !== void 0 || bits !== void 0) {
          if (bitOffset === void 0 || bits === void 0) {
            throw new Error(`Bitfield '${name}' requires both 'bitOffset' and 'bits'.`);
          }
          return { kind: "bitfield", name, bitStart: bitOffset, bitLength: bits, signed: signed2 };
        }
        const byteOffset = integerOption(definition, "offset", { minimum: 0 });
        if (byteOffset === void 0) throw new Error(`Scalar field '${name}' requires 'offset'.`);
        const width2 = integerOption(definition, "width", { minimum: 1, maximum: 4, fallback: 1 });
        const endianValue = stringOption(definition, "endian", defaultEndian);
        if (endianValue !== "little" && endianValue !== "big") {
          throw new Error(`Scalar field '${name}' has an invalid byte order.`);
        }
        return {
          kind: "scalar",
          name,
          bitStart: byteOffset * 8,
          bitLength: width2 * 8,
          byteOffset,
          width: width2,
          endian: endianValue,
          signed: signed2
        };
      });
      for (let left = 0; left < fields.length; left++) {
        const leftEnd = fields[left].bitStart + fields[left].bitLength;
        for (let right = left + 1; right < fields.length; right++) {
          const rightEnd = fields[right].bitStart + fields[right].bitLength;
          if (fields[left].bitStart < rightEnd && fields[right].bitStart < leftEnd) {
            throw new Error(
              `Struct fields '${fields[left].name}' and '${fields[right].name}' overlap.`
            );
          }
        }
      }
      const requiredBits = fields.reduce(
        (maximum, field) => Math.max(maximum, field.bitStart + field.bitLength),
        -Infinity
      );
      const requiredStride = Math.ceil(requiredBits / 8);
      const stride = integerOption(options, "stride", { minimum: requiredStride }) ?? requiredStride;
      return { fields, stride };
    };
    settings4 = (context) => {
      const options = optionsFor(context);
      const { fields, stride } = parseFields(options);
      const { count, size } = resolveCountAndSize(context, stride, options);
      return { options, fields, stride, count, size };
    };
    readBits = (bytes, base, field) => {
      let value = 0;
      for (let index = 0; index < field.bitLength; index++) {
        const bit2 = field.bitStart + index;
        if (((bytes[base + Math.floor(bit2 / 8)] ?? 0) & 1 << bit2 % 8) !== 0) {
          value += 2 ** index;
        }
      }
      const modulus = 2 ** field.bitLength;
      return field.signed && value >= modulus / 2 ? value - modulus : value;
    };
    writeBits = (bytes, base, field, value) => {
      const modulus = 2 ** field.bitLength;
      const minimum = field.signed ? -modulus / 2 : 0;
      const maximum = field.signed ? modulus / 2 - 1 : modulus - 1;
      if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`Field '${field.name}' value does not fit ${field.bitLength} bits.`);
      }
      const encoded = value < 0 ? value + modulus : value;
      for (let index = 0; index < field.bitLength; index++) {
        const bit2 = field.bitStart + index;
        const byteIndex = base + Math.floor(bit2 / 8);
        const mask = 1 << bit2 % 8;
        bytes[byteIndex] = (encoded & 2 ** index) === 0 ? bytes[byteIndex] & ~mask : bytes[byteIndex] | mask;
      }
    };
    structArrayAssetCodec = Object.freeze({
      id: STRUCT_ARRAY_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const { fields, stride, count, size } = settings4(context);
        return {
          size,
          metadata: {
            count,
            stride,
            bitOrder: "lsb0",
            fields: fields.map((field) => ({ ...field }))
          }
        };
      },
      decode: (context) => {
        const { options, fields, stride, count } = settings4(context);
        const bytes = readExactAssetBytes(context);
        const records = Array.from({ length: count }, (_, recordIndex) => {
          const base = recordIndex * stride;
          return Object.fromEntries(
            fields.map((field) => [
              field.name,
              field.kind === "scalar" ? readInteger(bytes, base + field.byteOffset, field.width, field.endian, field.signed) : readBits(bytes, base, field)
            ])
          );
        });
        const value = {
          kind: "struct-array",
          raw: [...bytes],
          records
        };
        const path9 = stringOption(options, "path", defaultAssetPath(context.request.id, "json"));
        return { value, files: [jsonFile(path9, value)] };
      },
      encode: (context) => {
        const { fields, stride, count, size } = settings4(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        const raw = byteArray(value.raw, `Struct asset '${context.request.id}' raw bytes`);
        if (raw.length !== size) {
          throw new Error(
            `Struct asset '${context.request.id}' raw backing must remain ${size} bytes.`
          );
        }
        if (!Array.isArray(value.records) || value.records.length !== count) {
          throw new Error(`Struct asset '${context.request.id}' requires exactly ${count} records.`);
        }
        const bytes = Uint8Array.from(raw);
        value.records.forEach((recordValue, recordIndex) => {
          const record = objectValue(recordValue, `Struct record ${recordIndex}`);
          const base = recordIndex * stride;
          for (const field of fields) {
            const fieldValue = record[field.name];
            if (typeof fieldValue !== "number") {
              throw new Error(`Struct field '${field.name}' requires an integer value.`);
            }
            if (field.kind === "scalar") {
              writeInteger(
                bytes,
                base + field.byteOffset,
                field.width,
                field.endian,
                fieldValue,
                field.signed
              );
            } else {
              writeBits(bytes, base, field, fieldValue);
            }
          }
        });
        return bytes;
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/text.ts
var TEXT_ASSET_CODEC_ID, parseByteKey, settings5, inspectedSize, textValue, encodeText, textAssetCodec;
var init_text = __esm({
  "packages/disassembler/src/asset-codecs/text.ts"() {
    "use strict";
    init_common();
    TEXT_ASSET_CODEC_ID = "uttori.asset.text";
    parseByteKey = (key2) => {
      const normalized = key2.startsWith("$") ? `0x${key2.slice(1)}` : key2;
      let value = Number.NaN;
      if (/^0x[\da-f]+$/i.test(normalized)) {
        value = Number.parseInt(normalized.slice(2), 16);
      } else if (/^\d+$/.test(normalized)) {
        value = Number.parseInt(normalized, 10);
      }
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        throw new Error(`Text table byte '${key2}' must be in the range 0..255.`);
      }
      return value;
    };
    settings5 = (context) => {
      const options = optionsFor(context);
      const byteToToken = /* @__PURE__ */ new Map();
      if (booleanOption(options, "ascii", true)) {
        byteToToken.set(9, "	");
        byteToToken.set(10, "\n");
        byteToToken.set(13, "\r");
        for (let byte = 32; byte <= 126; byte++) {
          if (byte !== 92) byteToToken.set(byte, String.fromCharCode(byte));
        }
      }
      const table = objectValue(options.table, "Text asset option 'table'");
      for (const [key2, tokenValue] of Object.entries(table)) {
        if (typeof tokenValue !== "string" || tokenValue.length === 0 || tokenValue.includes("\\")) {
          throw new Error(`Text table entry '${key2}' must be a non-empty string without backslashes.`);
        }
        byteToToken.set(parseByteKey(key2), tokenValue);
      }
      const tokenToByte = [...byteToToken.entries()].map(([byte, token]) => [token, byte]);
      const tokens = /* @__PURE__ */ new Set();
      for (const [token] of tokenToByte) {
        if (tokens.has(token)) throw new Error(`Text table token '${token}' is duplicated.`);
        tokens.add(token);
      }
      for (const [left] of tokenToByte) {
        const ambiguous = tokenToByte.find(
          ([right]) => left !== right && (left.startsWith(right) || right.startsWith(left))
        );
        if (ambiguous) {
          throw new Error(`Text table tokens '${left}' and '${ambiguous[0]}' are not prefix-free.`);
        }
      }
      tokenToByte.sort(([left], [right]) => right.length - left.length || left.localeCompare(right));
      const terminator = integerOption(options, "terminator", { minimum: 0, maximum: 255 });
      return { options, byteToToken, tokenToByte, terminator };
    };
    inspectedSize = (context, resolved) => {
      if (context.request.length !== void 0) return context.request.length;
      if (resolved.terminator === void 0) {
        throw new Error(`Text asset '${context.request.id}' requires a length or terminator.`);
      }
      const maxLength = integerOption(resolved.options, "maxLength", { minimum: 1 });
      if (maxLength === void 0) {
        throw new Error(
          `Text asset '${context.request.id}' requires 'maxLength' for terminator search.`
        );
      }
      for (let size = 1; size <= maxLength; size++) {
        const bytes = context.source.read(context.request.sourceOffset + size - 1, 1);
        if (!bytes) break;
        if (bytes[0] === resolved.terminator) return size;
      }
      throw new Error(
        `Text asset '${context.request.id}' has no terminator within ${maxLength} bytes.`
      );
    };
    textValue = (bytes, resolved) => [...bytes].map(
      (byte) => resolved.byteToToken.get(byte) ?? `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`
    ).join("");
    encodeText = (text, resolved, owner) => {
      const bytes = [];
      for (let offset = 0; offset < text.length; ) {
        if (text[offset] === "\\" && /^\\x[\da-f]{2}/i.test(text.slice(offset, offset + 4))) {
          bytes.push(Number.parseInt(text.slice(offset + 2, offset + 4), 16));
          offset += 4;
          continue;
        }
        const match = resolved.tokenToByte.find(([token]) => text.startsWith(token, offset));
        if (!match) {
          throw new Error(`Text asset '${owner}' cannot encode text at character ${offset}.`);
        }
        bytes.push(match[1]);
        offset += match[0].length;
      }
      return Uint8Array.from(bytes);
    };
    textAssetCodec = Object.freeze({
      id: TEXT_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const resolved = settings5(context);
        const size = inspectedSize(context, resolved);
        return {
          size,
          metadata: {
            encoding: "single-byte-translation-table",
            terminated: resolved.terminator !== void 0,
            ...resolved.terminator === void 0 ? {} : { terminator: resolved.terminator }
          }
        };
      },
      decode: (context) => {
        const resolved = settings5(context);
        const bytes = readAssetBytes(context, context.inspection.size);
        const terminated = resolved.terminator !== void 0 && bytes.at(-1) === resolved.terminator;
        const payload = terminated ? bytes.subarray(0, -1) : bytes;
        const value = { kind: "text", text: textValue(payload, resolved), terminated };
        const path9 = stringOption(
          resolved.options,
          "path",
          defaultAssetPath(context.request.id, "txt")
        );
        return {
          value,
          files: [
            {
              path: path9,
              mediaType: "text/plain; charset=utf-8",
              bytes: new TextEncoder().encode(value.text)
            }
          ]
        };
      },
      encode: (context) => {
        const resolved = settings5(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        const text = value.text;
        const terminated = value.terminated;
        if (typeof text !== "string" || typeof terminated !== "boolean") {
          throw new Error(
            `Text asset '${context.request.id}' requires string text and terminated flag.`
          );
        }
        const payload = encodeText(text, resolved, context.request.id);
        if (!terminated) return payload;
        if (resolved.terminator === void 0) {
          throw new Error(
            `Text asset '${context.request.id}' cannot append an unconfigured terminator.`
          );
        }
        const bytes = new Uint8Array(payload.length + 1);
        bytes.set(payload);
        bytes[bytes.length - 1] = resolved.terminator;
        return bytes;
      }
    });
  }
});

// packages/disassembler/src/asset-codecs/index.ts
var builtinAssetCodecs;
var init_asset_codecs = __esm({
  "packages/disassembler/src/asset-codecs/index.ts"() {
    "use strict";
    init_index_table();
    init_pointer_table();
    init_raw();
    init_scalar_array();
    init_struct_array();
    init_text();
    init_index_table();
    init_pointer_table();
    init_raw();
    init_scalar_array();
    init_struct_array();
    init_text();
    builtinAssetCodecs = Object.freeze(
      [
        indexTableAssetCodec,
        pointerTableAssetCodec,
        rawAssetCodec,
        scalarArrayAssetCodec,
        structArrayAssetCodec,
        textAssetCodec
      ].sort((left, right) => left.id.localeCompare(right.id))
    );
  }
});

// packages/disassembler/src/asset-preview.ts
var init_asset_preview = __esm({
  "packages/disassembler/src/asset-preview.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/analysis-graph.ts
var sortedUnique, sortedUniqueNumbers, addressKey, outputOffsetsFor, buildAnalysisCallGraph;
var init_analysis_graph = __esm({
  "packages/disassembler/src/analysis-graph.ts"() {
    "use strict";
    sortedUnique = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
    sortedUniqueNumbers = (values) => [...new Set(values)].sort((left, right) => left - right);
    addressKey = (addressSpace, address3) => `${addressSpace}:${address3}`;
    outputOffsetsFor = (nodeIds, nodesById) => sortedUniqueNumbers(
      nodeIds.flatMap((id) => {
        const node = nodesById.get(id);
        return node?.fileOffset === void 0 ? [] : [node.fileOffset];
      })
    );
    buildAnalysisCallGraph = (shards) => {
      const nodes = shards.analysis.filter(
        (record) => record.kind === "cfg-node"
      );
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const functionRecords = shards.analysis.filter(
        (record) => record.kind === "function"
      );
      const functionsByAddress = /* @__PURE__ */ new Map();
      for (const fn of functionRecords) {
        const key2 = addressKey(fn.addressSpace, fn.address);
        functionsByAddress.set(key2, [...functionsByAddress.get(key2) ?? [], fn]);
      }
      const ownersByNode = /* @__PURE__ */ new Map();
      const ownerFunctionIds = (node) => {
        if (!node) return [];
        const cached = ownersByNode.get(node.id);
        if (cached) return cached;
        const path9 = node.evidencePath.length > 0 ? node.evidencePath : [node.id];
        for (let index = path9.length - 1; index >= 0; index--) {
          const candidate = nodesById.get(path9[index]);
          if (!candidate) continue;
          const matches = functionsByAddress.get(addressKey(candidate.addressSpace, candidate.address));
          if (matches) {
            const owners = sortedUnique(matches.map(({ id }) => id));
            ownersByNode.set(node.id, owners);
            return owners;
          }
        }
        ownersByNode.set(node.id, []);
        return [];
      };
      const callRecords = shards.analysis.filter(
        (record) => record.kind === "cfg-edge" && (record.edgeKind === "call" || record.edgeKind === "interrupt") && record.toAddress !== void 0
      );
      const calls = callRecords.map((edge) => {
        const fromNode = nodesById.get(edge.from);
        const callerFunctionIds = ownerFunctionIds(fromNode);
        const calleeFunctionIds = sortedUnique(
          (functionsByAddress.get(addressKey(edge.addressSpace, edge.toAddress)) ?? []).map(
            ({ id }) => id
          )
        );
        const toNodeIds = edge.to ? [edge.to] : [];
        return {
          id: edge.id,
          edgeKind: edge.edgeKind,
          addressSpace: edge.addressSpace,
          fromAddress: edge.fromAddress,
          toAddress: edge.toAddress,
          fromNodeId: edge.from,
          ...edge.to ? { toNodeId: edge.to } : {},
          callerFunctionIds,
          calleeFunctionIds,
          fromOutputOffsets: outputOffsetsFor([edge.from], nodesById),
          toOutputOffsets: outputOffsetsFor(toNodeIds, nodesById),
          indirect: edge.indirect,
          ...edge.override ? { override: edge.override } : {},
          ...edge.explanation ? { explanation: edge.explanation } : {},
          evidence: edge.evidence
        };
      });
      const unresolvedRecords = shards.analysis.filter(
        (record) => record.kind === "unresolved"
      );
      const unresolvedEdges = shards.analysis.filter(
        (record) => record.kind === "cfg-edge" && record.edgeKind === "unresolved"
      );
      const unresolved = unresolvedRecords.map((record) => {
        const matchingNodes = sortedUnique(
          unresolvedEdges.filter(
            (edge) => edge.addressSpace === record.addressSpace && edge.fromAddress === record.address
          ).map(({ from }) => from)
        );
        return {
          id: record.id,
          addressSpace: record.addressSpace,
          address: record.address,
          flowKind: record.flowKind,
          indirect: record.indirect,
          reason: record.reason,
          nodeIds: matchingNodes,
          ownerFunctionIds: sortedUnique(
            matchingNodes.flatMap((id) => ownerFunctionIds(nodesById.get(id)))
          ),
          outputOffsets: outputOffsetsFor(matchingNodes, nodesById),
          evidence: record.evidence
        };
      });
      const nodeIdsByFunction = /* @__PURE__ */ new Map();
      const append2 = (map, key2, id) => {
        const entries3 = map.get(key2);
        if (entries3) entries3.push(id);
        else map.set(key2, [id]);
      };
      const incoming = /* @__PURE__ */ new Map();
      const outgoing = /* @__PURE__ */ new Map();
      const unresolvedByOwner = /* @__PURE__ */ new Map();
      for (const call of calls) {
        for (const id of call.calleeFunctionIds) append2(incoming, id, call.id);
        for (const id of call.callerFunctionIds) append2(outgoing, id, call.id);
      }
      for (const record of unresolved) {
        for (const id of record.ownerFunctionIds) append2(unresolvedByOwner, id, record.id);
      }
      for (const node of nodes) {
        for (const owner of ownerFunctionIds(node)) {
          append2(nodeIdsByFunction, owner, node.id);
        }
      }
      const functions = functionRecords.map((fn) => {
        const nodeIds = sortedUnique(nodeIdsByFunction.get(fn.id) ?? []);
        return {
          id: fn.id,
          addressSpace: fn.addressSpace,
          address: fn.address,
          source: fn.source,
          labels: shards.labels.filter((label) => label.addressSpace === fn.addressSpace && label.address === fn.address).map(({ id, name }) => ({ id, name })).sort((left, right) => left.id.localeCompare(right.id)),
          nodeIds,
          outputOffsets: outputOffsetsFor(
            nodeIds.filter((id) => nodesById.get(id)?.address === fn.address),
            nodesById
          ),
          incomingCallIds: sortedUnique(incoming.get(fn.id) ?? []),
          outgoingCallIds: sortedUnique(outgoing.get(fn.id) ?? []),
          unresolvedIds: sortedUnique(unresolvedByOwner.get(fn.id) ?? []),
          evidence: fn.evidence
        };
      });
      return {
        functions: functions.sort(
          (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
        ),
        calls: calls.sort(
          (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.fromAddress - right.fromAddress || left.toAddress - right.toAddress || left.id.localeCompare(right.id)
        ),
        unresolved: unresolved.sort(
          (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
        ),
        orphanCallIds: sortedUnique(
          calls.filter(
            ({ callerFunctionIds, calleeFunctionIds }) => callerFunctionIds.length === 0 || calleeFunctionIds.length === 0
          ).map(({ id }) => id)
        ),
        orphanUnresolvedIds: sortedUnique(
          unresolved.filter(({ ownerFunctionIds: owners }) => owners.length === 0).map(({ id }) => id)
        )
      };
    };
  }
});

// packages/disassembler/src/compression-codec.ts
var init_compression_codec = __esm({
  "packages/disassembler/src/compression-codec.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/coverage-map.ts
var CLASSIFICATION_ORDER, RUNTIME_ORDER, annotationClassification, compareStrings, arraysEqual, segmentsEqual, coverageAddressSpace, buildRomCoverageMap;
var init_coverage_map = __esm({
  "packages/disassembler/src/coverage-map.ts"() {
    "use strict";
    CLASSIFICATION_ORDER = [
      "opcode",
      "operand",
      "data",
      "asset",
      "unknown"
    ];
    RUNTIME_ORDER = ["executed", "operand", "read", "written"];
    annotationClassification = (classification) => {
      switch (classification) {
        case "opcode":
        case "operand":
          return classification;
        case "graphics":
        case "music":
        case "compressed":
        case "asset":
          return "asset";
        case "unreached":
          return void 0;
        default:
          return "data";
      }
    };
    compareStrings = (left, right) => left.localeCompare(right);
    arraysEqual = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
    segmentsEqual = (left, right) => left.status === right.status && arraysEqual(left.classifications, right.classifications) && arraysEqual(left.runtime, right.runtime) && arraysEqual(left.annotationIds, right.annotationIds) && arraysEqual(left.analysisIds, right.analysisIds) && arraysEqual(left.runtimeIds, right.runtimeIds) && arraysEqual(left.conflictIds, right.conflictIds) && arraysEqual(left.regionIds, right.regionIds);
    coverageAddressSpace = (record) => {
      if (record.kind === "runtime-coverage" || record.kind === "runtime-execution") {
        return record.addressSpace;
      }
      if (record.kind === "runtime-memory-access") return record.accessedAddressSpace;
      return void 0;
    };
    buildRomCoverageMap = (manifest, shards, runtime = shards.runtime) => {
      const contentSize = manifest.rom.contentSize;
      if (!Number.isSafeInteger(contentSize) || contentSize < 0) {
        throw new Error("ROM coverage requires a non-negative safe content size.");
      }
      const fileAddressSpaces = manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id).sort(compareStrings);
      const fileAddressSpaceSet = new Set(fileAddressSpaces);
      const events = /* @__PURE__ */ new Map();
      const unprojected = [];
      const diagnostics = [];
      let nextToken = 0;
      const eventAt = (offset) => {
        let event = events.get(offset);
        if (!event) {
          event = { starts: [], ends: [] };
          events.set(offset, event);
        }
        return event;
      };
      const addOverlay = (overlay, start, end, source) => {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
          unprojected.push({ ...source, reason: "invalid-range" });
          return false;
        }
        if (start >= contentSize || end <= 0 || contentSize === 0) {
          unprojected.push({ ...source, reason: "outside-rom" });
          return false;
        }
        const clippedStart = Math.max(0, start);
        const clippedEnd = Math.min(contentSize, end);
        if (clippedStart !== start || clippedEnd !== end) {
          diagnostics.push({
            recordId: source.id,
            message: `Clipped coverage range [${start}, ${end}) to ROM content [${clippedStart}, ${clippedEnd}).`
          });
        }
        const value = {
          ...overlay,
          token: nextToken++,
          start: clippedStart,
          end: clippedEnd
        };
        eventAt(clippedStart).starts.push(value);
        eventAt(clippedEnd).ends.push(value);
        return true;
      };
      const addAddressSpaceOverlay = (overlay, start, end, source) => {
        if (!source.addressSpace || !fileAddressSpaceSet.has(source.addressSpace)) {
          unprojected.push({ ...source, reason: "non-file-address-space" });
          return false;
        }
        return addOverlay(overlay, start, end, source);
      };
      for (const annotation of shards.annotations) {
        const classification = annotationClassification(annotation.classification);
        if (!classification) continue;
        addAddressSpaceOverlay(
          { classification, annotationId: annotation.id },
          annotation.start,
          annotation.end,
          { kind: "annotation", id: annotation.id, addressSpace: annotation.addressSpace }
        );
      }
      for (const region of shards.regions) {
        addAddressSpaceOverlay({ regionId: region.id }, region.start, region.end, {
          kind: "region",
          id: region.id,
          addressSpace: region.addressSpace
        });
      }
      const controlFlowNodes = /* @__PURE__ */ new Map();
      for (const record of shards.analysis) {
        if (record.kind !== "cfg-node") continue;
        controlFlowNodes.set(record.id, record);
        if (record.fileOffset === void 0) {
          unprojected.push({
            kind: "analysis",
            id: record.id,
            addressSpace: record.addressSpace,
            reason: "missing-file-offset"
          });
          continue;
        }
        addOverlay(
          { classification: "opcode", analysisId: record.id },
          record.fileOffset,
          record.fileOffset + 1,
          { kind: "analysis", id: record.id, addressSpace: record.addressSpace }
        );
        if (record.size > 1) {
          addOverlay(
            { classification: "operand", analysisId: record.id },
            record.fileOffset + 1,
            record.fileOffset + record.size,
            { kind: "analysis", id: record.id, addressSpace: record.addressSpace }
          );
        }
      }
      const addConflict = (record) => {
        if (fileAddressSpaceSet.has(record.addressSpace)) {
          addOverlay({ conflictId: record.id }, record.address, record.end ?? record.address + 1, {
            kind: "analysis",
            id: record.id,
            addressSpace: record.addressSpace
          });
          return;
        }
        let projected = false;
        for (const nodeId of record.nodes) {
          const node = controlFlowNodes.get(nodeId);
          if (!node || node.fileOffset === void 0) continue;
          projected = addOverlay(
            { conflictId: record.id, analysisId: node.id },
            node.fileOffset,
            node.fileOffset + node.size,
            { kind: "analysis", id: record.id, addressSpace: record.addressSpace }
          ) || projected;
        }
        if (!projected) {
          unprojected.push({
            kind: "analysis",
            id: record.id,
            addressSpace: record.addressSpace,
            reason: "missing-file-offset"
          });
        }
      };
      for (const record of shards.analysis) {
        if (record.kind === "conflict") addConflict(record);
      }
      const addRuntimeAddressSpaceOverlay = (record, runtime2, start, end) => {
        const addressSpace = coverageAddressSpace(record);
        addAddressSpaceOverlay({ runtime: runtime2, runtimeId: record.id }, start, end, {
          kind: "runtime",
          id: record.id,
          addressSpace
        });
      };
      for (const record of runtime) {
        if (record.kind === "runtime-coverage") {
          addRuntimeAddressSpaceOverlay(record, record.coverage, record.start, record.end);
          continue;
        }
        if (record.kind === "runtime-execution") {
          if (record.fileOffset === void 0) {
            unprojected.push({
              kind: "runtime",
              id: record.id,
              addressSpace: record.addressSpace,
              reason: "missing-file-offset"
            });
            continue;
          }
          const size = record.size ?? 1;
          addOverlay(
            { runtime: "executed", runtimeId: record.id },
            record.fileOffset,
            record.fileOffset + 1,
            { kind: "runtime", id: record.id, addressSpace: record.addressSpace }
          );
          if (size > 1) {
            addOverlay(
              { runtime: "operand", runtimeId: record.id },
              record.fileOffset + 1,
              record.fileOffset + size,
              { kind: "runtime", id: record.id, addressSpace: record.addressSpace }
            );
          }
          continue;
        }
        if (record.kind === "runtime-memory-access") {
          if (!fileAddressSpaceSet.has(record.accessedAddressSpace)) continue;
          if (record.access === "read" || record.access === "read-write") {
            addRuntimeAddressSpaceOverlay(
              record,
              "read",
              record.accessedAddress,
              record.accessedAddress + record.width
            );
          }
          if (record.access === "write" || record.access === "read-write") {
            addRuntimeAddressSpaceOverlay(
              record,
              "written",
              record.accessedAddress,
              record.accessedAddress + record.width
            );
          }
        }
      }
      eventAt(0);
      eventAt(contentSize);
      const boundaries = [...events.keys()].sort((left, right) => left - right);
      const active = /* @__PURE__ */ new Map();
      const segments = [];
      for (let index = 0; index + 1 < boundaries.length; index++) {
        const start = boundaries[index];
        const event = events.get(start);
        for (const overlay of event.ends) active.delete(overlay.token);
        for (const overlay of event.starts) active.set(overlay.token, overlay);
        const end = boundaries[index + 1];
        if (end <= start) continue;
        const values = [...active.values()];
        const classifications = /* @__PURE__ */ new Set();
        for (const { classification } of values) {
          if (classification) classifications.add(classification);
        }
        const sortedClassifications = classifications.size === 0 ? ["unknown"] : [...classifications];
        sortedClassifications.sort(
          (left, right) => CLASSIFICATION_ORDER.indexOf(left) - CLASSIFICATION_ORDER.indexOf(right)
        );
        const conflictIds = [
          ...new Set(values.flatMap(({ conflictId }) => conflictId ? [conflictId] : []))
        ].sort(compareStrings);
        let status = "classified";
        if (classifications.size === 0 && conflictIds.length === 0) status = "unknown";
        else if (classifications.size > 1 || conflictIds.length > 0) status = "conflict";
        const segment = {
          start,
          end,
          status,
          classifications: sortedClassifications,
          runtime: [...new Set(values.flatMap(({ runtime: runtime2 }) => runtime2 ? [runtime2] : []))].sort(
            (left, right) => RUNTIME_ORDER.indexOf(left) - RUNTIME_ORDER.indexOf(right)
          ),
          annotationIds: [
            ...new Set(values.flatMap(({ annotationId }) => annotationId ? [annotationId] : []))
          ].sort(compareStrings),
          analysisIds: [
            ...new Set(values.flatMap(({ analysisId }) => analysisId ? [analysisId] : []))
          ].sort(compareStrings),
          runtimeIds: [
            ...new Set(values.flatMap(({ runtimeId }) => runtimeId ? [runtimeId] : []))
          ].sort(compareStrings),
          conflictIds,
          regionIds: [...new Set(values.flatMap(({ regionId }) => regionId ? [regionId] : []))].sort(
            compareStrings
          )
        };
        const previous = segments.at(-1);
        if (previous && previous.end === segment.start && segmentsEqual(previous, segment)) {
          segments[segments.length - 1] = { ...previous, end: segment.end };
        } else {
          segments.push(segment);
        }
      }
      const bytesByClassification = {
        opcode: 0,
        operand: 0,
        data: 0,
        asset: 0,
        unknown: 0
      };
      const bytesByRuntimeCoverage = {
        executed: 0,
        operand: 0,
        read: 0,
        written: 0
      };
      let classifiedBytes = 0;
      let unknownBytes = 0;
      let conflictBytes = 0;
      for (const segment of segments) {
        const size = segment.end - segment.start;
        for (const classification of segment.classifications) {
          bytesByClassification[classification] += size;
        }
        for (const runtime2 of segment.runtime) bytesByRuntimeCoverage[runtime2] += size;
        if (segment.status === "classified") classifiedBytes += size;
        else if (segment.status === "unknown") unknownBytes += size;
        else conflictBytes += size;
      }
      return {
        contentSize,
        fileAddressSpaces,
        segments,
        summary: {
          totalBytes: contentSize,
          classifiedBytes,
          unknownBytes,
          conflictBytes,
          segmentCount: segments.length,
          bytesByClassification,
          bytesByRuntimeCoverage
        },
        unprojected: unprojected.sort(
          (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id) || left.reason.localeCompare(right.reason)
        ),
        diagnostics: diagnostics.sort(
          (left, right) => left.recordId.localeCompare(right.recordId) || left.message.localeCompare(right.message)
        )
      };
    };
  }
});

// packages/disassembler/src/canonical-json.ts
var canonicalValue, canonicalJson;
var init_canonical_json = __esm({
  "packages/disassembler/src/canonical-json.ts"() {
    "use strict";
    canonicalValue = (value) => {
      if (Array.isArray(value)) return value.map(canonicalValue);
      if (value !== null && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key2, entry]) => [key2, canonicalValue(entry)])
        );
      return value;
    };
    canonicalJson = (value) => `${JSON.stringify(canonicalValue(value), void 0, 2)}
`;
  }
});

// packages/disassembler/src/project-types.ts
var ANALYSIS_PROJECT_FORMAT, ANALYSIS_PROJECT_SCHEMA_VERSION, ANALYSIS_PROJECT_MANIFEST;
var init_project_types = __esm({
  "packages/disassembler/src/project-types.ts"() {
    "use strict";
    ANALYSIS_PROJECT_FORMAT = "uttori-asm-analysis";
    ANALYSIS_PROJECT_SCHEMA_VERSION = 3;
    ANALYSIS_PROJECT_MANIFEST = "analysis.json";
  }
});

// packages/disassembler/src/record-id-set.ts
var import_node_fs, import_node_os, import_node_path, import_node_sqlite, RecordIdSet;
var init_record_id_set = __esm({
  "packages/disassembler/src/record-id-set.ts"() {
    "use strict";
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_os = __toESM(require("node:os"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_sqlite = require("node:sqlite");
    RecordIdSet = class {
      #ids = /* @__PURE__ */ new Set();
      #characters = 0;
      #directory;
      #database;
      #insert;
      /**
       * Claim an ID while keeping the in-memory prefix small.
       * @param {string} id Complete record identity.
       * @returns {boolean} False only for an exact duplicate.
       */
      add(id) {
        if (this.#insert) return this.#insert.run(id).changes !== 0;
        if (this.#ids.has(id)) return false;
        this.#ids.add(id);
        this.#characters += id.length;
        if (this.#characters > 4 * 1024 * 1024) this.#spill();
        return true;
      }
      #spill() {
        this.#directory = import_node_fs.default.mkdtempSync(import_node_path.default.join(import_node_os.default.tmpdir(), "uttori-record-ids-"));
        try {
          this.#database = new import_node_sqlite.DatabaseSync(import_node_path.default.join(this.#directory, "ids.sqlite"));
          this.#database.exec(
            "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-4096; CREATE TABLE ids (id TEXT PRIMARY KEY) WITHOUT ROWID; BEGIN;"
          );
          this.#insert = this.#database.prepare("INSERT OR IGNORE INTO ids VALUES (?)");
          for (const id of this.#ids) this.#insert.run(id);
          this.#ids.clear();
        } catch (error) {
          this.close();
          throw error;
        }
      }
      /** Release both memory and any disposable database, including after a failed validation. */
      close() {
        try {
          this.#database?.close();
        } finally {
          this.#database = void 0;
          this.#insert = void 0;
          this.#ids.clear();
          if (this.#directory) import_node_fs.default.rmSync(this.#directory, { recursive: true, force: true });
          this.#directory = void 0;
        }
      }
    };
  }
});

// packages/disassembler/src/trace-detail.ts
var isArray, validateRuntimeInstructionDetails;
var init_trace_detail = __esm({
  "packages/disassembler/src/trace-detail.ts"() {
    "use strict";
    isArray = (value) => Array.isArray(value);
    validateRuntimeInstructionDetails = (value, count) => {
      if (!Array.isArray(value) || value.length !== count)
        throw new Error("Trace details must align one-to-one with instruction addresses.");
      return value.map((detail) => {
        if (!detail || !isArray(detail.bytes) || detail.bytes.length < 1 || detail.bytes.length > 16 || detail.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255))
          throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
        if (!detail.state || typeof detail.state !== "object" || isArray(detail.state) || Object.entries(detail.state).some(
          ([key2, entry]) => !key2 || !["number", "string", "boolean"].includes(typeof entry) || typeof entry === "number" && !Number.isFinite(entry)
        ))
          throw new Error("Trace instruction state contains an invalid register value.");
        if (detail.droppedMemoryAccesses !== void 0 && (!Number.isSafeInteger(detail.droppedMemoryAccesses) || detail.droppedMemoryAccesses < 0))
          throw new Error("Trace memory loss must be a non-negative safe integer.");
        if (detail.memoryAccesses !== void 0 && (!isArray(detail.memoryAccesses) || detail.memoryAccesses.length > 256))
          throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
        const memoryAccesses = detail.memoryAccesses?.map((access) => {
          if (!access || typeof access.addressSpace !== "string" || !access.addressSpace || !Number.isSafeInteger(access.address) || access.address < 0 || !["read", "write", "fetch"].includes(access.access) || !Number.isSafeInteger(access.width) || access.width < 1 || access.width > 8 || access.value !== void 0 && (!Number.isSafeInteger(access.value) || access.value < 0) || access.actor !== void 0 && !["cpu", "dma", "hdma"].includes(access.actor) || access.channel !== void 0 && (!Number.isInteger(access.channel) || access.channel < 0 || access.channel > 7 || !["dma", "hdma"].includes(access.actor ?? "cpu")))
            throw new Error("Trace contains an invalid bus operation.");
          return { ...access };
        });
        return {
          bytes: [...detail.bytes],
          state: { ...detail.state },
          ...memoryAccesses === void 0 ? {} : { memoryAccesses },
          ...detail.droppedMemoryAccesses === void 0 ? {} : { droppedMemoryAccesses: detail.droppedMemoryAccesses }
        };
      });
    };
  }
});

// packages/disassembler/src/project-validation.ts
var validateAnalysisProjectManifest, FORBIDDEN_ROM_PAYLOAD_KEYS, assertNoRomPayload, isStableId, assertCodecReference, createRuntimeRecordValidator, validateRuntimeRecords, validateLoadedShards;
var init_project_validation = __esm({
  "packages/disassembler/src/project-validation.ts"() {
    "use strict";
    init_project_types();
    init_record_id_set();
    init_trace_detail();
    validateAnalysisProjectManifest = (manifest) => {
      if (manifest.format !== ANALYSIS_PROJECT_FORMAT) {
        throw new Error(`Unsupported analysis project format '${String(manifest.format)}'.`);
      }
      if (manifest.schemaVersion !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported analysis project schema version ${String(manifest.schemaVersion)}.`
        );
      }
      if (!/^[\da-f]{64}$/.test(manifest.rom.sha256)) throw new Error("Invalid ROM SHA-256.");
      if (!/^[\da-f]{64}$/.test(manifest.rom.contentSha256)) {
        throw new Error("Invalid ROM content SHA-256.");
      }
      const addressSpaceIds = /* @__PURE__ */ new Set();
      for (const addressSpace of manifest.addressSpaces) {
        if (addressSpace.id === "" || addressSpace.name === "") {
          throw new Error("Analysis address spaces require non-empty ids and names.");
        }
        if (addressSpaceIds.has(addressSpace.id)) {
          throw new Error(`Duplicate analysis address-space id '${addressSpace.id}'.`);
        }
        if (!Number.isSafeInteger(addressSpace.addressBits) || addressSpace.addressBits <= 0 || addressSpace.addressBits > 53) {
          throw new Error(`Analysis address space '${addressSpace.id}' has invalid address bits.`);
        }
        addressSpaceIds.add(addressSpace.id);
      }
      if (manifest.db !== void 0 && manifest.db !== "analysis.sqlite")
        throw new Error(`Unsupported analysis sqlite path '${manifest.db}'.`);
      if (manifest.revision !== void 0 && (!Number.isSafeInteger(manifest.revision) || manifest.revision < 0))
        throw new Error("Invalid analysis sqlite revision.");
      if (manifest.shards.length !== 0)
        throw new Error("Legacy analysis shards are no longer supported; use a SQLite project.");
    };
    FORBIDDEN_ROM_PAYLOAD_KEYS = /* @__PURE__ */ new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);
    assertNoRomPayload = (value, location) => {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
          assertNoRomPayload(value[index], `${location}[${index}]`);
        }
        return;
      }
      if (!value || typeof value !== "object") return;
      for (const [key2, entry] of Object.entries(value)) {
        if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key2)) {
          throw new Error(`ROM byte payload '${location}.${key2}' is forbidden in analysis projects.`);
        }
        assertNoRomPayload(entry, `${location}.${key2}`);
      }
    };
    isStableId = (id) => {
      const isAlphaNumeric = (character) => {
        const code = character.charCodeAt(0);
        return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
      };
      if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1))) return false;
      for (let index = 0; index < id.length; index++) {
        const character = id[index];
        if (!isAlphaNumeric(character) && !"._:/-".includes(character)) return false;
      }
      return true;
    };
    assertCodecReference = (reference, location) => {
      if (typeof reference.codecId !== "string" || !isStableId(reference.codecId)) {
        throw new Error(`${location} has an invalid codec id.`);
      }
      if (typeof reference.codecVersion !== "string" || reference.codecVersion.trim() === "") {
        throw new Error(`${location} has no codec version.`);
      }
      if (reference.provider) {
        if (typeof reference.provider.pluginId !== "string" || !isStableId(reference.provider.pluginId)) {
          throw new Error(`${location} has an invalid provider plugin id.`);
        }
        if (typeof reference.provider.pluginVersion !== "string" || reference.provider.pluginVersion.trim() === "") {
          throw new Error(`${location} has no provider plugin version.`);
        }
      }
      const visitJson = (value, current2) => {
        if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry, index) => visitJson(entry, `${current2}[${index}]`));
          return;
        }
        if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
          Object.entries(value).forEach(([key2, entry]) => visitJson(entry, `${current2}.${key2}`));
          return;
        }
        throw new Error(`${current2} is not a JSON-safe codec option.`);
      };
      if (reference.options !== void 0) visitJson(reference.options, `${location} options`);
    };
    createRuntimeRecordValidator = (project, evidence, checkDuplicateIds = true) => {
      const ids = checkDuplicateIds ? new RecordIdSet() : void 0;
      const evidenceIds = new Set(evidence.map((record) => record.id));
      const addressSpaceById = new Map(project.addressSpaces.map((space) => [space.id, space]));
      const validate = (record) => {
        if (!record || typeof record.id !== "string" || record.id === "")
          throw new Error("Analysis shard 'runtime' contains a record without an id.");
        if (ids && !ids.add(record.id))
          throw new Error(`Analysis shard 'runtime' contains duplicate id '${record.id}'.`);
        for (const id of record.evidence ?? []) {
          if (!evidenceIds.has(id))
            throw new Error(`Analysis record '${record.id}' refers to missing evidence '${id}'.`);
        }
        if (!Number.isSafeInteger(record.count) || record.count <= 0) {
          throw new Error(`Runtime record '${record.id}' has an invalid observation count.`);
        }
        if (record.kind === "runtime-coverage") {
          if (!Number.isSafeInteger(record.start) || !Number.isSafeInteger(record.end) || record.start < 0 || record.end <= record.start) {
            throw new Error(`Runtime coverage '${record.id}' has an invalid half-open range.`);
          }
        }
        if (record.kind === "runtime-memory-access") {
          if (record.actor !== void 0 && !["cpu", "dma", "hdma"].includes(record.actor) || record.channel !== void 0 && (!Number.isInteger(record.channel) || record.channel < 0 || record.channel > 7 || !["dma", "hdma"].includes(record.actor ?? "cpu")))
            throw new Error(`Runtime memory access '${record.id}' has an invalid actor/channel.`);
          if (!Number.isSafeInteger(record.width) || record.width <= 0) {
            throw new Error(`Runtime memory access '${record.id}' has an invalid width.`);
          }
          if (record.value !== void 0 && (!Number.isSafeInteger(record.value) || record.value < 0)) {
            throw new Error(`Runtime memory access '${record.id}' has an invalid value.`);
          }
        }
        if (record.kind === "runtime-execution") {
          if (record.size !== void 0 && (!Number.isSafeInteger(record.size) || record.size <= 0)) {
            throw new Error(`Runtime execution '${record.id}' has an invalid instruction size.`);
          }
          if (record.opcode !== void 0 && (!Number.isInteger(record.opcode) || record.opcode < 0 || record.opcode > 255)) {
            throw new Error(`Runtime execution '${record.id}' has an invalid opcode.`);
          }
          if (record.fileOffset !== void 0 && (!Number.isSafeInteger(record.fileOffset) || record.fileOffset < 0 || record.fileOffset >= project.rom.contentSize)) {
            throw new Error(`Runtime execution '${record.id}' has an invalid ROM file offset.`);
          }
        }
        if (record.kind === "runtime-instruction") {
          validateRuntimeInstructionDetails([{ bytes: record.bytes, state: record.state }], 1);
        }
        if (record.kind === "runtime-cpu-state") {
          for (const [name, value] of Object.entries(record.state)) {
            if (name === "" || !["string", "boolean", "number"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value)) {
              throw new Error(`Runtime CPU state '${record.id}' has invalid field '${name}'.`);
            }
          }
        }
        if ("addressSpace" in record) {
          const space = addressSpaceById.get(record.addressSpace);
          if (!space)
            throw new Error(
              `Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`
            );
          const addresses3 = record.kind === "runtime-coverage" ? [record.start, record.end - 1] : [record.address];
          if (addresses3.some(
            (address3) => !Number.isSafeInteger(address3) || address3 < 0 || address3 >= 2 ** space.addressBits
          ))
            throw new Error(
              `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`
            );
        }
        let addresses2 = [];
        if (record.kind === "runtime-memory-access") {
          addresses2 = [
            [record.instructionAddressSpace, record.instructionAddress],
            [record.accessedAddressSpace, record.accessedAddress]
          ];
        } else if (record.kind === "runtime-control-target") {
          addresses2 = [
            [record.fromAddressSpace, record.fromAddress],
            [record.toAddressSpace, record.toAddress]
          ];
        }
        for (const [spaceId, address3] of addresses2) {
          const addressSpace = addressSpaceById.get(spaceId);
          if (!addressSpace) {
            throw new Error(
              `Runtime record '${record.id}' refers to unknown address space '${spaceId}'.`
            );
          }
          if (!Number.isSafeInteger(address3) || address3 < 0 || address3 >= 2 ** addressSpace.addressBits) {
            throw new Error(`Runtime record '${record.id}' exceeds address space '${spaceId}'.`);
          }
        }
        assertNoRomPayload(record, `shards.runtime.${record.id}`);
      };
      return Object.assign(validate, { close: () => ids?.close() });
    };
    validateRuntimeRecords = (records, project, evidence) => {
      const validate = createRuntimeRecordValidator(project, evidence);
      try {
        for (const record of records) validate(record);
      } finally {
        validate.close();
      }
    };
    validateLoadedShards = (shards, project) => {
      const { addressSpaces } = project;
      const evidenceIds = new Set(shards.evidence.map((record) => record.id));
      for (const [kind, records] of Object.entries(shards)) {
        if (kind === "runtime") continue;
        const ids = /* @__PURE__ */ new Set();
        for (const record of records) {
          if (!record || typeof record.id !== "string" || record.id === "") {
            throw new Error(`Analysis shard '${kind}' contains a record without an id.`);
          }
          if (ids.has(record.id)) {
            throw new Error(`Analysis shard '${kind}' contains duplicate id '${record.id}'.`);
          }
          ids.add(record.id);
          for (const evidence of record.evidence ?? []) {
            if (!evidenceIds.has(evidence)) {
              throw new Error(
                `Analysis record '${record.id}' refers to missing evidence '${evidence}'.`
              );
            }
          }
        }
      }
      for (const evidence of shards.evidence) {
        if (!evidence.artifact) continue;
        if (evidence.artifact.format === "" || !/^[\da-f]{64}$/.test(evidence.artifact.sha256) || !/^[\da-f]{64}$/.test(evidence.artifact.romContentSha256)) {
          throw new Error(`Evidence '${evidence.id}' has an invalid artifact identity.`);
        }
        if (evidence.artifact.romContentSha256 !== project.rom.contentSha256) {
          throw new Error(`Evidence '${evidence.id}' belongs to a different ROM.`);
        }
        if (evidence.artifact.mapper && evidence.artifact.mapper !== project.mapping.mapper) {
          throw new Error(`Evidence '${evidence.id}' belongs to a different mapper.`);
        }
      }
      for (const interval of [...shards.annotations, ...shards.regions]) {
        if (!Number.isSafeInteger(interval.start) || !Number.isSafeInteger(interval.end) || interval.start < 0 || interval.end <= interval.start) {
          throw new Error(`Analysis interval '${interval.id}' has an invalid half-open range.`);
        }
      }
      for (const annotation of shards.annotations) {
        if (!annotation.asset) continue;
        if (!["asset", "compressed", "graphics", "music", "text"].includes(annotation.classification)) {
          throw new Error(
            `Analysis annotation '${annotation.id}' cannot attach an asset codec to '${annotation.classification}'.`
          );
        }
        assertCodecReference(annotation.asset, `Analysis annotation '${annotation.id}' asset codec`);
        const compression = annotation.asset.compression;
        if (!compression) continue;
        assertCodecReference(compression, `Analysis annotation '${annotation.id}' compression codec`);
        const rangeSize = annotation.end - annotation.start;
        const maximumSize = compression.maximumSize ?? rangeSize;
        if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0 || maximumSize > rangeSize) {
          throw new Error(
            `Analysis annotation '${annotation.id}' compression maximumSize must be within its range.`
          );
        }
        const hasBankStart = compression.bankStart !== void 0;
        const hasBankEnd = compression.bankEnd !== void 0;
        if (hasBankStart !== hasBankEnd) {
          throw new Error(
            `Analysis annotation '${annotation.id}' compression bank bounds must be supplied together.`
          );
        }
        const bankStart = compression.bankStart;
        const bankEnd = compression.bankEnd;
        if (hasBankStart && (typeof bankStart !== "number" || typeof bankEnd !== "number" || !Number.isSafeInteger(bankStart) || !Number.isSafeInteger(bankEnd) || bankStart < 0 || bankEnd <= bankStart || annotation.start < bankStart || annotation.end > bankEnd)) {
          throw new Error(
            `Analysis annotation '${annotation.id}' has invalid compression bank bounds.`
          );
        }
        if (compression.fillByte !== void 0 && (!Number.isInteger(compression.fillByte) || compression.fillByte < 0 || compression.fillByte > 255)) {
          throw new Error(
            `Analysis annotation '${annotation.id}' has an invalid compression fillByte.`
          );
        }
      }
      for (const conflict of shards.analysis) {
        if (conflict.kind !== "conflict" || conflict.end === void 0) continue;
        if (!Number.isSafeInteger(conflict.end) || conflict.end <= conflict.address) {
          throw new Error(`Analysis conflict '${conflict.id}' has an invalid half-open range.`);
        }
      }
      const regionsById = new Map(shards.regions.map((region) => [region.id, region]));
      for (const region of shards.regions) {
        if (!region.parentRegion) continue;
        const parent = regionsById.get(region.parentRegion);
        if (!parent) {
          throw new Error(
            `Analysis region '${region.id}' refers to missing parent region '${region.parentRegion}'.`
          );
        }
        const visited = /* @__PURE__ */ new Set([region.id]);
        let ancestor = parent;
        while (ancestor.parentRegion) {
          if (visited.has(ancestor.id)) {
            throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
          }
          visited.add(ancestor.id);
          const next = regionsById.get(ancestor.parentRegion);
          if (!next) break;
          ancestor = next;
        }
        if (visited.has(ancestor.id)) {
          throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
        }
        if (parent.addressSpace === region.addressSpace && (region.start < parent.start || region.end > parent.end)) {
          throw new Error(
            `Analysis region '${region.id}' is not contained by parent region '${parent.id}'.`
          );
        }
      }
      for (const addressed of [...shards.labels, ...shards.comments]) {
        if (!Number.isSafeInteger(addressed.address) || addressed.address < 0) {
          throw new Error(`Analysis record '${addressed.id}' has an invalid address.`);
        }
      }
      for (const label of shards.labels) {
        if (label.sourceName !== void 0 && (typeof label.sourceName !== "string" || !/^[A-Z_a-z]\w*$/.test(label.sourceName)))
          throw new Error(`Analysis label '${label.id}' has an invalid source name.`);
        if (label.inlineComment !== void 0 && (typeof label.inlineComment !== "string" || /[\n\r\u2028\u2029]/.test(label.inlineComment)))
          throw new Error(`Analysis label '${label.id}' requires a single-line inline comment.`);
        if (label.analysisEntryPoint !== void 0 && typeof label.analysisEntryPoint !== "boolean")
          throw new Error(`Analysis label '${label.id}' has an invalid analysisEntryPoint.`);
      }
      for (const comment of shards.comments) {
        if (comment.placement !== void 0 && !["before", "inline-instruction"].includes(comment.placement))
          throw new Error(`Analysis comment '${comment.id}' has an invalid placement.`);
        if (comment.placement === "inline-instruction" && (typeof comment.text !== "string" || /[\n\r\u2028\u2029]/.test(comment.text)))
          throw new Error(`Analysis comment '${comment.id}' requires a single-line inline comment.`);
      }
      const addressSpaceById = new Map(
        addressSpaces.map((addressSpace) => [addressSpace.id, addressSpace])
      );
      const addressedRecords = [
        ...shards.annotations,
        ...shards.labels,
        ...shards.comments,
        ...shards.regions,
        ...shards.analysis.filter(
          (record) => "addressSpace" in record
        )
      ];
      for (const record of addressedRecords) {
        const addressSpace = addressSpaceById.get(record.addressSpace);
        if (!addressSpace) {
          throw new Error(
            `Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`
          );
        }
        const maximum = 2 ** addressSpace.addressBits;
        const addresses2 = [];
        if ("start" in record) {
          addresses2.push(record.start, record.end - 1);
        } else if ("address" in record) {
          addresses2.push(record.address);
          if ("kind" in record && record.kind === "conflict" && record.end !== void 0) {
            addresses2.push(record.end - 1);
          }
        } else {
          if ("fromAddress" in record) addresses2.push(record.fromAddress);
          if ("toAddress" in record && record.toAddress !== void 0) addresses2.push(record.toAddress);
          if ("targets" in record) for (const target of record.targets) addresses2.push(target);
        }
        if (addresses2.some(
          (address3) => !Number.isSafeInteger(address3) || address3 < 0 || address3 >= maximum
        )) {
          throw new Error(
            `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`
          );
        }
      }
      validateRuntimeRecords(shards.runtime, project, shards.evidence);
      assertNoRomPayload({ ...shards, runtime: [] }, "shards");
    };
  }
});

// packages/disassembler/src/sqlite-maintenance.ts
var import_node_fs2, import_node_path2, SQLITE_MIGRATION_DIRECTORY, assertNoSqliteMigration, sqliteFileIdentity;
var init_sqlite_maintenance = __esm({
  "packages/disassembler/src/sqlite-maintenance.ts"() {
    "use strict";
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_path2 = __toESM(require("node:path"), 1);
    SQLITE_MIGRATION_DIRECTORY = ".analysis-storage-migration";
    assertNoSqliteMigration = (file) => {
      if (import_node_fs2.default.existsSync(import_node_path2.default.join(import_node_path2.default.dirname(file), SQLITE_MIGRATION_DIRECTORY)))
        throw new Error(
          "Analysis storage migration is in progress. Retry after it completes, or run project-migrate to recover an interrupted migration."
        );
    };
    sqliteFileIdentity = (file) => {
      const stat = import_node_fs2.default.statSync(file, { bigint: true });
      return `${stat.dev}:${stat.ino}`;
    };
  }
});

// packages/disassembler/src/sqlite-payload.ts
var import_node_util, import_node_zlib, MAX_SQLITE_PAYLOAD_BYTES, HEADER, HEADER_BYTES, utf8, encodeSqlitePayload, decodeSqlitePayload, sqliteRuntimeIdentity, decodeSqliteRuntimeIdentity;
var init_sqlite_payload = __esm({
  "packages/disassembler/src/sqlite-payload.ts"() {
    "use strict";
    import_node_util = require("node:util");
    import_node_zlib = require("node:zlib");
    MAX_SQLITE_PAYLOAD_BYTES = 16 * 1024 * 1024;
    HEADER = Buffer.from([85, 65, 80, 1]);
    HEADER_BYTES = 8;
    utf8 = new import_node_util.TextDecoder("utf-8", { fatal: true });
    encodeSqlitePayload = (json) => {
      const bytes = Buffer.byteLength(json);
      if (bytes > MAX_SQLITE_PAYLOAD_BYTES)
        throw new Error(`SQLite record exceeds the ${MAX_SQLITE_PAYLOAD_BYTES}-byte payload limit.`);
      if (bytes < 256) return json;
      const compressed = (0, import_node_zlib.deflateSync)(json, { level: 1, chunkSize: Math.min(bytes, 16 * 1024) });
      if (compressed.length + HEADER_BYTES > bytes - Math.max(32, Math.ceil(bytes / 8))) return json;
      const result = Buffer.allocUnsafe(HEADER_BYTES + compressed.length);
      HEADER.copy(result);
      result.writeUInt32LE(bytes, 4);
      compressed.copy(result, HEADER_BYTES);
      return result;
    };
    decodeSqlitePayload = (value) => {
      if (typeof value === "string") {
        if (Buffer.byteLength(value) > MAX_SQLITE_PAYLOAD_BYTES)
          throw new Error("SQLite text payload exceeds the decoded size limit.");
        return value;
      }
      if (!import_node_util.types.isUint8Array(value)) throw new Error("Invalid SQLite payload representation.");
      const encoded = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      if (encoded.length <= HEADER_BYTES || !encoded.subarray(0, 4).equals(HEADER))
        throw new Error("Unsupported or truncated SQLite payload codec.");
      const bytes = encoded.readUInt32LE(4);
      if (bytes === 0 || bytes > MAX_SQLITE_PAYLOAD_BYTES)
        throw new Error("SQLite compressed payload exceeds the decoded size limit.");
      try {
        const decoded = (0, import_node_zlib.inflateSync)(encoded.subarray(HEADER_BYTES), {
          maxOutputLength: bytes,
          chunkSize: Math.max(64, Math.min(bytes, 16 * 1024))
        });
        if (decoded.length !== bytes)
          throw new Error("Decoded payload length does not match its header.");
        return utf8.decode(decoded);
      } catch (cause) {
        throw new Error("Corrupt SQLite compressed payload.", { cause });
      }
    };
    sqliteRuntimeIdentity = (id) => {
      const split = id.lastIndexOf(":") + 1;
      const suffix = id.slice(split);
      return {
        prefix: id.slice(0, split),
        suffix: /^[\da-f]{64}$/.test(suffix) ? Buffer.from(suffix, "hex") : suffix
      };
    };
    decodeSqliteRuntimeIdentity = (prefix, suffix) => {
      if (typeof prefix !== "string") throw new Error("Invalid SQLite runtime ID prefix.");
      if (typeof suffix === "string") return prefix + suffix;
      if (!import_node_util.types.isUint8Array(suffix) || suffix.length !== 32)
        throw new Error("Invalid SQLite runtime ID suffix.");
      return prefix + Buffer.from(suffix).toString("hex");
    };
  }
});

// packages/disassembler/src/sqlite-records.ts
var compareRuntimeRecordIds, runtimeColumns, runtimeFromRow, analysisAddress;
var init_sqlite_records = __esm({
  "packages/disassembler/src/sqlite-records.ts"() {
    "use strict";
    init_sqlite_payload();
    compareRuntimeRecordIds = (left, right) => {
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    };
    runtimeColumns = (record) => {
      switch (record.kind) {
        case "runtime-execution":
          return {
            addressSpace: record.addressSpace,
            address: record.address,
            start: null,
            end: null,
            fromAddressSpace: null,
            fromAddress: null,
            toAddressSpace: null,
            toAddress: null,
            instructionAddressSpace: null,
            instructionAddress: null,
            accessedAddressSpace: null,
            accessedAddress: null,
            coverage: null,
            payload: JSON.stringify({
              ...record.fileOffset === void 0 ? {} : { fileOffset: record.fileOffset },
              ...record.size === void 0 ? {} : { size: record.size },
              ...record.opcode === void 0 ? {} : { opcode: record.opcode }
            })
          };
        case "runtime-instruction":
          return {
            addressSpace: record.addressSpace,
            address: record.address,
            start: null,
            end: null,
            fromAddressSpace: null,
            fromAddress: null,
            toAddressSpace: null,
            toAddress: null,
            instructionAddressSpace: null,
            instructionAddress: null,
            accessedAddressSpace: null,
            accessedAddress: null,
            coverage: null,
            payload: JSON.stringify({ bytes: record.bytes, state: record.state })
          };
        case "runtime-memory-access":
          return {
            addressSpace: null,
            address: null,
            start: null,
            end: null,
            fromAddressSpace: null,
            fromAddress: null,
            toAddressSpace: null,
            toAddress: null,
            instructionAddressSpace: record.instructionAddressSpace,
            instructionAddress: record.instructionAddress,
            accessedAddressSpace: record.accessedAddressSpace,
            accessedAddress: record.accessedAddress,
            coverage: null,
            payload: JSON.stringify({
              access: record.access,
              width: record.width,
              ...record.actor === void 0 ? {} : { actor: record.actor },
              ...record.channel === void 0 ? {} : { channel: record.channel },
              ...record.value === void 0 ? {} : { value: record.value }
            })
          };
        case "runtime-cpu-state":
          return {
            addressSpace: record.addressSpace,
            address: record.address,
            start: null,
            end: null,
            fromAddressSpace: null,
            fromAddress: null,
            toAddressSpace: null,
            toAddress: null,
            instructionAddressSpace: null,
            instructionAddress: null,
            accessedAddressSpace: null,
            accessedAddress: null,
            coverage: null,
            payload: JSON.stringify({ state: record.state })
          };
        case "runtime-coverage":
          return {
            addressSpace: record.addressSpace,
            address: null,
            start: record.start,
            end: record.end,
            fromAddressSpace: null,
            fromAddress: null,
            toAddressSpace: null,
            toAddress: null,
            instructionAddressSpace: null,
            instructionAddress: null,
            accessedAddressSpace: null,
            accessedAddress: null,
            coverage: record.coverage,
            payload: null
          };
        case "runtime-control-target":
          return {
            addressSpace: null,
            address: null,
            start: null,
            end: null,
            fromAddressSpace: record.fromAddressSpace,
            fromAddress: record.fromAddress,
            toAddressSpace: record.toAddressSpace,
            toAddress: record.toAddress,
            instructionAddressSpace: null,
            instructionAddress: null,
            accessedAddressSpace: null,
            accessedAddress: null,
            coverage: null,
            payload: JSON.stringify({ flowKind: record.flowKind, indirect: record.indirect })
          };
      }
      throw new Error("Unsupported runtime evidence kind.");
    };
    runtimeFromRow = (row) => {
      const fields = row;
      const extra = fields.payload === null || fields.payload === void 0 ? {} : JSON.parse(decodeSqlitePayload(fields.payload));
      if (typeof fields.evidence !== "string")
        throw new Error("Missing SQLite runtime evidence dictionary entry.");
      const evidence = JSON.parse(fields.evidence);
      const kind = fields.kind;
      const architecture = fields.architecture;
      const count = Number(fields.count);
      const id = fields.id_prefix === void 0 ? fields.id : decodeSqliteRuntimeIdentity(fields.id_prefix, fields.id);
      if (kind === "runtime-execution") {
        return {
          id,
          kind,
          architecture,
          count,
          evidence,
          addressSpace: fields.address_space,
          address: Number(fields.address),
          ...extra
        };
      }
      if (kind === "runtime-instruction") {
        return {
          id,
          kind,
          architecture,
          count,
          evidence,
          addressSpace: fields.address_space,
          address: Number(fields.address),
          bytes: extra.bytes,
          state: extra.state
        };
      }
      if (kind === "runtime-memory-access") {
        return {
          id,
          kind,
          architecture,
          count,
          evidence,
          instructionAddressSpace: fields.instruction_address_space,
          instructionAddress: Number(fields.instruction_address),
          accessedAddressSpace: fields.accessed_address_space,
          accessedAddress: Number(fields.accessed_address),
          access: extra.access,
          width: extra.width,
          ...extra.actor === void 0 ? {} : { actor: extra.actor },
          ...extra.channel === void 0 ? {} : { channel: extra.channel },
          ...extra.value === void 0 ? {} : { value: extra.value }
        };
      }
      if (kind === "runtime-cpu-state") {
        return {
          id,
          kind,
          architecture,
          count,
          evidence,
          addressSpace: fields.address_space,
          address: Number(fields.address),
          state: extra.state
        };
      }
      if (kind === "runtime-coverage") {
        return {
          id,
          kind,
          architecture,
          count,
          evidence,
          addressSpace: fields.address_space,
          start: Number(fields.start),
          end: Number(fields.end),
          coverage: fields.coverage
        };
      }
      if (kind !== "runtime-control-target")
        throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
      return {
        id,
        kind: "runtime-control-target",
        architecture,
        count,
        evidence,
        fromAddressSpace: fields.from_address_space,
        fromAddress: Number(fields.from_address),
        toAddressSpace: fields.to_address_space,
        toAddress: Number(fields.to_address),
        flowKind: extra.flowKind,
        indirect: Boolean(extra.indirect)
      };
    };
    analysisAddress = (record) => {
      if ("addressSpace" in record && "address" in record)
        return { addressSpace: record.addressSpace, address: record.address };
      if ("addressSpace" in record && "fromAddress" in record)
        return { addressSpace: record.addressSpace, address: record.fromAddress };
      return { addressSpace: null, address: null };
    };
  }
});

// packages/disassembler/src/sqlite-store.ts
var import_node_crypto2, import_node_fs3, import_node_path3, import_node_sqlite2, ANALYSIS_PROJECT_SQLITE_FILE, ANALYSIS_SQLITE_STORAGE_VERSION, SCHEMA, SCHEMA_INDEX_STATEMENTS, RUNTIME_SELECT, analysisProjectSqlitePath, parseRecord, SqliteAnalysisStore;
var init_sqlite_store = __esm({
  "packages/disassembler/src/sqlite-store.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    import_node_fs3 = __toESM(require("node:fs"), 1);
    import_node_path3 = __toESM(require("node:path"), 1);
    import_node_sqlite2 = require("node:sqlite");
    init_canonical_json();
    init_project_types();
    init_sqlite_maintenance();
    init_sqlite_payload();
    init_sqlite_records();
    ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
    ANALYSIS_SQLITE_STORAGE_VERSION = 1;
    SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS labels (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regions (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT NOT NULL PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  classification TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  address_space TEXT,
  address INTEGER,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imports (
  id TEXT NOT NULL PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_prefixes (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS runtime_evidence (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS runtime (
  prefix_id INTEGER NOT NULL REFERENCES runtime_prefixes(id),
  id BLOB NOT NULL,
  kind TEXT NOT NULL,
  architecture TEXT NOT NULL,
  count INTEGER NOT NULL,
  address_space TEXT,
  address INTEGER,
  start INTEGER,
  "end" INTEGER,
  from_address_space TEXT,
  from_address INTEGER,
  to_address_space TEXT,
  to_address INTEGER,
  instruction_address_space TEXT,
  instruction_address INTEGER,
  accessed_address_space TEXT,
  accessed_address INTEGER,
  coverage TEXT,
  evidence_id INTEGER NOT NULL REFERENCES runtime_evidence(id),
  payload BLOB,
  UNIQUE (prefix_id, id)
);
PRAGMA user_version=1;
`;
    SCHEMA_INDEX_STATEMENTS = [
      "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
      "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
      'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
      'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
      "CREATE INDEX IF NOT EXISTS runtime_lookup ON runtime (kind, address_space, address, start)",
      "CREATE INDEX IF NOT EXISTS runtime_memory ON runtime (instruction_address_space, instruction_address) WHERE kind='runtime-memory-access'"
    ];
    RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;
    analysisProjectSqlitePath = (directory, manifest) => {
      const relative2 = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
      if (relative2 !== ANALYSIS_PROJECT_SQLITE_FILE)
        throw new Error(`Unsupported analysis sqlite path '${relative2}'.`);
      return import_node_path3.default.join(directory, relative2);
    };
    parseRecord = (payload) => JSON.parse(decodeSqlitePayload(payload));
    SqliteAnalysisStore = class {
      #database;
      #fileIdentity;
      file;
      #insertEvidence;
      #insertLabel;
      #insertComment;
      #insertRegion;
      #insertAnnotation;
      #insertAnalysis;
      #insertImport;
      #insertRuntime;
      #findRuntime;
      #dictionaryStatements = /* @__PURE__ */ new Map();
      /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
      #dictionaryIds = /* @__PURE__ */ new Map();
      #dictionaryCacheBytes = 0;
      /**
       * Opens or creates a project database.
       * @param {string} file Absolute sqlite path.
       * @param {boolean} [createSchema] Permit initialization of an empty database; never upgrade an existing one.
       * @param {boolean} [deferIndexes] Migration-only bulk load; finishMigration must build indexes before publication.
       */
      constructor(file, createSchema = true, deferIndexes = false) {
        assertNoSqliteMigration(file);
        if (!createSchema && !import_node_fs3.default.existsSync(file))
          throw new Error(`Analysis database does not exist: ${file}`);
        this.file = file;
        this.#database = new import_node_sqlite2.DatabaseSync(file, { open: true });
        this.#fileIdentity = sqliteFileIdentity(file);
        try {
          const empty = Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
          const initialVersion = Number(
            this.#database.prepare("PRAGMA user_version").get()?.user_version
          );
          if (createSchema && empty && initialVersion === 0) {
            this.#database.exec(SCHEMA);
            if (!deferIndexes) for (const sql of SCHEMA_INDEX_STATEMENTS) this.#database.exec(sql);
          }
          const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
          if (version !== ANALYSIS_SQLITE_STORAGE_VERSION)
            throw new Error(
              `Unsupported analysis storage format ${version}; expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Run uttori-asm project-migrate <project-directory> for an older SQLite project.`
            );
          this.#database.exec(
            "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE;"
          );
          this.#insertEvidence = this.#database.prepare(
            "INSERT INTO evidence (id, payload) VALUES (?, ?)"
          );
          this.#insertLabel = this.#database.prepare(
            "INSERT INTO labels (id, address_space, address, name, payload) VALUES (?, ?, ?, ?, ?)"
          );
          this.#insertComment = this.#database.prepare(
            "INSERT INTO comments (id, address_space, address, payload) VALUES (?, ?, ?, ?)"
          );
          this.#insertRegion = this.#database.prepare(
            'INSERT INTO regions (id, address_space, start, "end", payload) VALUES (?, ?, ?, ?, ?)'
          );
          this.#insertAnnotation = this.#database.prepare(
            'INSERT INTO annotations (id, address_space, start, "end", classification, payload) VALUES (?, ?, ?, ?, ?, ?)'
          );
          this.#insertAnalysis = this.#database.prepare(
            "INSERT INTO analysis (id, kind, address_space, address, payload) VALUES (?, ?, ?, ?, ?)"
          );
          this.#insertImport = this.#database.prepare(
            "INSERT INTO imports (id, payload) VALUES (?, ?)"
          );
          for (const table of ["runtime_prefixes", "runtime_evidence"]) {
            this.#dictionaryStatements.set(table, {
              find: this.#database.prepare(`SELECT id FROM ${table} WHERE value=?`),
              insert: this.#database.prepare(`INSERT INTO ${table} (value) VALUES (?)`)
            });
          }
          this.#findRuntime = this.#database.prepare(`${RUNTIME_SELECT}
        WHERE r.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND r.id=?`);
          this.#insertRuntime = this.#database.prepare(
            `INSERT INTO runtime (
          prefix_id, id, kind, architecture, count, address_space, address, start, "end",
          from_address_space, from_address, to_address_space, to_address,
          instruction_address_space, instruction_address, accessed_address_space, accessed_address,
          coverage, evidence_id, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
        } catch (error) {
          this.#database.close();
          throw error;
        }
      }
      /**
       * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
       * A cleanup error must never replace the original failure reported to the user.
       */
      rollback() {
        this.#clearDictionaryCache();
        if (!this.#database.isTransaction) return;
        try {
          this.#database.exec("ROLLBACK");
        } catch {
        }
      }
      /** Forget all transaction-owned dictionary references and their bounded text allocation. */
      #clearDictionaryCache() {
        this.#dictionaryIds.clear();
        this.#dictionaryCacheBytes = 0;
      }
      /**
       * Intern exact text with a bounded cache; callers hold the SQLite writer lock.
       * @param {string} table One of the two prepared dictionary tables.
       * @param {string} value Exact prefix or serialized evidence list.
       * @returns {number} Transactionally created or existing dictionary rowid.
       */
      #intern(table, value) {
        const key2 = `${table}:${value}`;
        const cached = this.#dictionaryIds.get(key2);
        if (cached !== void 0) return cached;
        const statements = this.#dictionaryStatements.get(table);
        const found = statements.find.get(value);
        const id = found ? Number(found.id) : Number(statements.insert.run(value).lastInsertRowid);
        const bytes = Buffer.byteLength(key2);
        if (this.#dictionaryIds.size >= 256 || this.#dictionaryCacheBytes + bytes > 512 * 1024)
          this.#clearDictionaryCache();
        if (bytes <= 512 * 1024) {
          this.#dictionaryIds.set(key2, id);
          this.#dictionaryCacheBytes += bytes;
        }
        return id;
      }
      #insertRecord(kind, value) {
        if (kind === "evidence") {
          const record2 = value;
          this.#insertEvidence.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
          return;
        }
        if (kind === "labels") {
          const record2 = value;
          this.#insertLabel.run(
            record2.id,
            record2.addressSpace,
            record2.address,
            record2.name,
            encodeSqlitePayload(JSON.stringify(record2))
          );
          return;
        }
        if (kind === "comments") {
          const record2 = value;
          this.#insertComment.run(
            record2.id,
            record2.addressSpace,
            record2.address,
            encodeSqlitePayload(JSON.stringify(record2))
          );
          return;
        }
        if (kind === "regions") {
          const record2 = value;
          this.#insertRegion.run(
            record2.id,
            record2.addressSpace,
            record2.start,
            record2.end,
            encodeSqlitePayload(JSON.stringify(record2))
          );
          return;
        }
        if (kind === "annotations") {
          const record2 = value;
          this.#insertAnnotation.run(
            record2.id,
            record2.addressSpace,
            record2.start,
            record2.end,
            record2.classification,
            encodeSqlitePayload(JSON.stringify(record2))
          );
          return;
        }
        if (kind === "analysis") {
          const record2 = value;
          const located = analysisAddress(record2);
          this.#insertAnalysis.run(
            record2.id,
            record2.kind,
            located.addressSpace,
            located.address,
            encodeSqlitePayload(JSON.stringify(record2))
          );
          return;
        }
        if (kind === "imports") {
          const record2 = value;
          this.#insertImport.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
          return;
        }
        const record = value;
        const columns = runtimeColumns(record);
        const identity = sqliteRuntimeIdentity(record.id);
        this.#insertRuntime.run(
          this.#intern("runtime_prefixes", identity.prefix),
          identity.suffix,
          record.kind,
          record.architecture,
          record.count,
          columns.addressSpace,
          columns.address,
          columns.start,
          columns.end,
          columns.fromAddressSpace,
          columns.fromAddress,
          columns.toAddressSpace,
          columns.toAddress,
          columns.instructionAddressSpace,
          columns.instructionAddress,
          columns.accessedAddressSpace,
          columns.accessedAddress,
          columns.coverage,
          this.#intern("runtime_evidence", JSON.stringify(record.evidence)),
          columns.payload === null ? null : encodeSqlitePayload(columns.payload)
        );
      }
      /**
       * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
       * the revision so a competing process cannot slip between the stale check and publication.
       * @param {Function} action Synchronous work; cursors must be consumed before returning.
       * @param {boolean} [write] Acquire the writer lock immediately; false creates a read snapshot.
       * @returns {T} Callback result after a successful commit.
       */
      transaction(action, write = true) {
        assertNoSqliteMigration(this.file);
        if (sqliteFileIdentity(this.file) !== this.#fileIdentity)
          throw new Error(
            "Analysis database was replaced; close this connection and reload the project."
          );
        this.#clearDictionaryCache();
        this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
        try {
          const result = action();
          this.#database.exec("COMMIT");
          this.#clearDictionaryCache();
          return result;
        } catch (error) {
          this.rollback();
          throw error;
        }
      }
      /**
       * Index trace chunks in a connection-local disk table. This transaction never reads or writes
       * main, allowing other project writers to proceed during asynchronous capture parsing.
       * @param {Function} action Async parser using only the supplied temporary counter index.
       * @returns {Promise} Parser result after temporary counters commit; the index lives until connection close.
       */
      async indexTrace(action) {
        this.#database.exec(`CREATE TEMP TABLE trace_facts (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, count INTEGER NOT NULL
    ) WITHOUT ROWID; BEGIN;`);
        const increment = this.#database.prepare(
          "UPDATE temp.trace_facts SET count=count+1 WHERE id=?"
        );
        const insert = this.#database.prepare("INSERT INTO temp.trace_facts VALUES (?, ?, 1)");
        const values = this.#database.prepare("SELECT payload, count FROM temp.trace_facts");
        const index = {
          add: (key2, create) => {
            if (increment.run(key2).changes !== 0) return false;
            insert.run(key2, JSON.stringify(create()));
            return true;
          },
          values: function* () {
            for (const row of values.iterate())
              yield {
                fact: parseRecord(row.payload),
                count: Number(row.count)
              };
          },
          clear: () => this.#database.exec("DELETE FROM temp.trace_facts")
        };
        try {
          const result = await action(index);
          this.#database.exec("COMMIT");
          this.#clearDictionaryCache();
          return result;
        } catch (error) {
          this.rollback();
          throw error;
        }
      }
      /** Require mutations to belong to an explicitly owned atomic publication. */
      #requireTransaction() {
        if (!this.#database.isTransaction) throw new Error("Analysis mutation requires a transaction.");
      }
      /**
       * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
       * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
       * Semantic validation belongs to the project publication API; this method must run in its transaction.
       * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
       */
      replaceTables(shards) {
        this.#requireTransaction();
        this.#database.exec(
          "CREATE TEMP TABLE IF NOT EXISTS replacement_ids (id TEXT PRIMARY KEY) WITHOUT ROWID"
        );
        const remember = this.#database.prepare("INSERT INTO temp.replacement_ids VALUES (?)");
        const tables = /* @__PURE__ */ new Set([
          "analysis",
          "annotations",
          "labels",
          "comments",
          "regions",
          "runtime",
          "evidence",
          "imports"
        ]);
        for (const kind of Object.keys(shards)) {
          if (!tables.has(kind)) throw new Error(`Unknown analysis table '${kind}'.`);
          if (kind === "runtime") {
            this.#replaceRuntime(shards.runtime ?? []);
            continue;
          }
          this.#database.exec("DELETE FROM temp.replacement_ids");
          const find = this.#database.prepare(`SELECT * FROM ${kind} WHERE id=?`);
          const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
          for (const record of shards[kind] ?? []) {
            remember.run(record.id);
            const prior = find.get(record.id);
            if (prior) {
              const before = parseRecord(prior.payload);
              if (canonicalJson(before) === canonicalJson(record)) continue;
              remove.run(record.id);
            }
            this.#insertRecord(kind, record);
          }
          this.#database.exec(
            `DELETE FROM ${kind} WHERE id NOT IN (SELECT id FROM temp.replacement_ids)`
          );
        }
      }
      /**
       * Replace runtime by integer storage IDs, keeping the temporary retention set compact.
       * @param {Array} records Complete semantic runtime replacement; duplicate IDs remain errors.
       */
      #replaceRuntime(records) {
        this.#database.exec(
          "CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (id INTEGER PRIMARY KEY); DELETE FROM replacement_runtime_ids"
        );
        const remember = this.#database.prepare("INSERT INTO temp.replacement_runtime_ids VALUES (?)");
        const seen = this.#database.prepare("SELECT 1 FROM temp.replacement_runtime_ids WHERE id=?");
        const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
        for (const record of records) {
          const identity = sqliteRuntimeIdentity(record.id);
          let prior = this.#findRuntime.get(identity.prefix, identity.suffix);
          if (prior && seen.get(prior.storage_rowid))
            throw new Error(`Duplicate runtime record ID '${record.id}'.`);
          if (prior && canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record)) {
            remove.run(prior.storage_rowid);
            prior = void 0;
          }
          if (!prior) {
            this.#insertRecord("runtime", record);
            prior = this.#findRuntime.get(identity.prefix, identity.suffix);
          }
          remember.run(prior.storage_rowid);
        }
        this.#database.exec(
          "DELETE FROM runtime WHERE rowid NOT IN (SELECT id FROM temp.replacement_runtime_ids)"
        );
      }
      /**
       * Append validated migration rows without materializing a complete table or comparing absent IDs.
       * @param {ShardKind} kind Destination semantic table.
       * @param {Iterable} records Bounded batch or lazy cursor; uniqueness is enforced by SQLite.
       */
      appendRecords(kind, records) {
        this.#requireTransaction();
        for (const record of records) this.#insertRecord(kind, record);
      }
      /**
       * Insert a content-addressed runtime fact once; an ID collision with different content is an
       * error, never a silent no-op. Count values are already aggregated within the source capture.
       * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
       * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
       */
      insertRuntime(record) {
        this.#requireTransaction();
        const identity = sqliteRuntimeIdentity(record.id);
        const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
        if (prior) {
          if (canonicalJson(runtimeFromRow(prior)) !== canonicalJson(record))
            throw new Error(
              `Runtime record '${record.id}' has changed content for a stable imported ID.`
            );
          return false;
        }
        this.#insertRecord("runtime", record);
        return true;
      }
      /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
      validateRuntimeEvidence() {
        const missing = this.#database.prepare(`
      SELECT ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      LEFT JOIN evidence ON evidence.id=ref.value
      WHERE evidence.id IS NULL AND EXISTS (SELECT 1 FROM runtime WHERE evidence_id=sets.id) LIMIT 1
    `).get();
        if (missing)
          throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
      }
      /**
       * Store manifest and counter in the same transaction as the changed records.
       * @param {object} manifest Semantic project identity for this publication.
       * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
       */
      publishManifest(manifest) {
        this.#requireTransaction();
        const revision = this.revision() + 1;
        const pointer = {
          ...manifest,
          db: ANALYSIS_PROJECT_SQLITE_FILE,
          revision,
          shards: []
        };
        const insert = this.#database.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)");
        insert.run("revision", String(revision));
        insert.run("manifest", canonicalJson(pointer));
        return pointer;
      }
      /**
       * Current publication counter.
       * @returns {number} Stored revision.
       */
      revision() {
        const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
        return Number(row?.v ?? 0);
      }
      /**
       * Manifest stored in meta, including sqlite pointer fields.
       * @returns {AnalysisProjectManifest} Pointer manifest.
       */
      manifest() {
        const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
        if (!row) throw new Error("Sqlite analysis project is missing its stored manifest.");
        return { ...parseRecord(row.v), revision: this.revision() };
      }
      /**
       * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
       * @param {Array} kinds Runtime discriminators to include; empty selects nothing.
       * @returns {IterableIterator} Cursor consumed within the owning read transaction.
       * @yields {RuntimeEvidenceRecord} One matching decoded fact.
       */
      *runtimeRecordsByKinds(kinds) {
        if (kinds.length === 0) return;
        const statement = this.#database.prepare(
          `${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`
        );
        for (const row of statement.iterate(...kinds)) yield runtimeFromRow(row);
      }
      /**
       * Read runtime observations at a selected location, including containing coverage ranges.
       * @param {string} addressSpace Logical address-space ID.
       * @param {number} address Nonnegative address in that space.
       * @returns {IterableIterator} Cursor over matching point and interval facts.
       * @yields {RuntimeEvidenceRecord} A fact associated with the selected location.
       */
      *runtimeAt(addressSpace, address3) {
        const query = this.#database.prepare(`
      ${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution', 'runtime-instruction', 'runtime-cpu-state')
        AND r.address_space=? AND r.address=?
      UNION ALL ${RUNTIME_SELECT} WHERE r.kind='runtime-coverage' AND r.address_space=? AND r.address IS NULL AND r.start<=? AND r."end">?
      UNION ALL ${RUNTIME_SELECT} WHERE r.kind='runtime-memory-access' AND r.instruction_address_space=? AND r.instruction_address=?
    `);
        for (const row of query.iterate(
          addressSpace,
          address3,
          addressSpace,
          address3,
          address3,
          addressSpace,
          address3
        ))
          yield runtimeFromRow(row);
      }
      /**
       * Stream runtime facts without retaining the complete table.
       * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
       * @yields {RuntimeEvidenceRecord} One runtime fact.
       */
      *runtimeRecords() {
        for (const row of this.#database.prepare(`${RUNTIME_SELECT} ORDER BY r.rowid`).iterate())
          yield runtimeFromRow(row);
      }
      /**
       * Read one metadata table directly; Sources must not load unrelated CFG or runtime tables.
       * @param {string} kind Metadata table name from the semantic collection contract.
       * @returns {Array} Decoded metadata in deterministic display order.
       */
      loadTable(kind) {
        const order = {
          labels: "address_space, address, id",
          comments: "address_space, address, id",
          annotations: 'address_space, start, "end", id',
          regions: 'address_space, start, "end", id',
          analysis: "id",
          evidence: "id",
          imports: "id"
        };
        if (!Object.hasOwn(order, kind)) throw new Error(`Unknown analysis table '${kind}'.`);
        const records = [];
        for (const row of this.#database.prepare(`SELECT payload FROM ${kind} ORDER BY ${order[kind]}`).iterate())
          records.push(parseRecord(row.payload));
        return records;
      }
      /**
       * Stream decoded records in insertion order for migration digest verification.
       * @param {ShardKind} kind Semantic table to traverse.
       * @returns {IterableIterator} Cursor retaining only the current decoded record.
       * @yields {object} Original semantic record.
       */
      *records(kind) {
        if (kind === "runtime") {
          yield* this.runtimeRecords();
          return;
        }
        if (!["evidence", "labels", "comments", "regions", "annotations", "analysis", "imports"].includes(
          kind
        ))
          throw new Error(`Unknown analysis table '${kind}'.`);
        for (const row of this.#database.prepare(`SELECT payload FROM ${kind} ORDER BY rowid`).iterate())
          yield parseRecord(row.payload);
      }
      /**
       * Initialize a migrated project's unchanged logical identity once, inside its first publication.
       * @param {AnalysisProjectManifest} manifest Validated authoritative source manifest and revision.
       */
      initializeMigratedManifest(manifest) {
        this.#requireTransaction();
        if (this.#database.prepare("SELECT 1 FROM meta LIMIT 1").get())
          throw new Error("Migration manifest can only initialize an empty metadata header.");
        const insert = this.#database.prepare("INSERT INTO meta (k,v) VALUES (?,?)");
        insert.run("revision", String(manifest.revision ?? 0));
        insert.run("manifest", canonicalJson(manifest));
      }
      /**
       * Build deferred indexes and check all physical structures before closing a staged migration file.
       * Switching through DELETE verifies that no staging reader retains a WAL dependency; the closed
       * file retains WAL mode for ordinary clients, with all committed pages checkpointed into main.
       */
      finishMigration() {
        for (const sql of SCHEMA_INDEX_STATEMENTS) this.#database.exec(sql);
        const integrity = this.#database.prepare("PRAGMA integrity_check").all();
        if (integrity.length !== 1 || integrity[0].integrity_check !== "ok")
          throw new Error("Migrated SQLite database failed integrity validation.");
        if (this.#database.prepare("PRAGMA foreign_key_check").get())
          throw new Error("Migrated SQLite database contains an invalid dictionary reference.");
        this.#database.exec(
          "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; PRAGMA journal_mode=WAL;"
        );
      }
      /**
       * Materialize metadata once; full runtime history is opt-in for callers that need it.
       * @param {boolean} [runtime] Include complete runtime history; false keeps it on disk.
       * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
       */
      loadShards(runtime = true) {
        return {
          evidence: this.loadTable("evidence"),
          labels: this.loadTable("labels"),
          comments: this.loadTable("comments"),
          regions: this.loadTable("regions"),
          annotations: this.loadTable("annotations"),
          analysis: this.loadTable("analysis"),
          imports: this.loadTable("imports"),
          runtime: runtime ? [...this.runtimeRecords()].sort(compareRuntimeRecordIds) : []
        };
      }
      /**
       * Table counts for reports.
       * @returns {Readonly<Record<string, number>>} Row counts.
       */
      counts() {
        const tables = [
          "evidence",
          "labels",
          "comments",
          "regions",
          "annotations",
          "analysis",
          "imports",
          "runtime"
        ];
        const result = {};
        for (const table of tables) {
          const row = this.#database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
          result[table] = Number(row?.n ?? 0);
        }
        return result;
      }
      /**
       * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
       * is reported as a warning, never as a failed import that could cause an unsafe retry.
       * @param {string} directory Project root for the watcher hint.
       */
      writePointer(directory) {
        const temporary = import_node_path3.default.join(directory, `.analysis.json.${(0, import_node_crypto2.randomUUID)()}.tmp`);
        try {
          this.transaction(() => {
            import_node_fs3.default.writeFileSync(temporary, canonicalJson(this.manifest()), { flag: "wx" });
            import_node_fs3.default.renameSync(temporary, import_node_path3.default.join(directory, ANALYSIS_PROJECT_MANIFEST));
          });
        } catch (error) {
          process.emitWarning(
            `Analysis database committed, but its watcher pointer could not be refreshed: ${String(error)}`
          );
        } finally {
          try {
            import_node_fs3.default.rmSync(temporary, { force: true });
          } catch {
          }
        }
      }
      /** Checkpoint and reclaim unused SQLite pages; run only during explicit storage maintenance. */
      compact() {
        const disk = import_node_fs3.default.statfsSync(import_node_path3.default.dirname(this.file));
        const pageCount = Number(this.#database.prepare("PRAGMA page_count").get()?.page_count);
        const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
        if (disk.bavail * disk.bsize < 2 * pageCount * pageSize)
          throw new Error(
            "Insufficient free disk space for SQLite VACUUM; allow twice the database size."
          );
        this.transaction(() => {
          this.#database.exec(`
        DELETE FROM runtime_prefixes WHERE id NOT IN (SELECT DISTINCT prefix_id FROM runtime);
        DELETE FROM runtime_evidence WHERE id NOT IN (SELECT DISTINCT evidence_id FROM runtime);
      `);
        });
        this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
      }
      /** Close prepared statements and the database. */
      close() {
        this.#database.close();
      }
    };
  }
});

// packages/disassembler/src/project-transaction.ts
var import_node_crypto3, fs4, import_node_path4, ANALYSIS_PROJECT_REVISION_FORMAT, ANALYSIS_PROJECT_REVISION_VERSION, AnalysisProjectStaleError, analysisProjectRevision, assertAnalysisProjectRevision, loadAnalysisProjectViewSnapshot, prepareAnalysisProjectTransaction, committed, publish, commitAnalysisProjectViewUpdate;
var init_project_transaction = __esm({
  "packages/disassembler/src/project-transaction.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
    fs4 = __toESM(require("node:fs"), 1);
    import_node_path4 = __toESM(require("node:path"), 1);
    init_canonical_json();
    init_project_store();
    init_project_types();
    init_project_validation();
    init_sqlite_store();
    ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
    ANALYSIS_PROJECT_REVISION_VERSION = 1;
    AnalysisProjectStaleError = class extends Error {
      constructor(expected, actual) {
        super(
          `Analysis project changed since it was loaded (expected ${expected.manifestSha256}, found ${actual.manifestSha256}).`
        );
        this.expected = expected;
        this.actual = actual;
        this.name = "AnalysisProjectStaleError";
      }
      expected;
      actual;
    };
    analysisProjectRevision = (manifest) => ({
      format: ANALYSIS_PROJECT_REVISION_FORMAT,
      version: ANALYSIS_PROJECT_REVISION_VERSION,
      manifestSha256: (0, import_node_crypto3.createHash)("sha256").update(canonicalJson(manifest)).digest("hex")
    });
    assertAnalysisProjectRevision = (store, expected) => {
      const actual = analysisProjectRevision(store.manifest());
      if (expected.manifestSha256 !== actual.manifestSha256)
        throw new AnalysisProjectStaleError(expected, actual);
    };
    loadAnalysisProjectViewSnapshot = (directory, createProjection) => {
      const project = loadAnalysisProjectView(directory, createProjection);
      return { ...project, revision: analysisProjectRevision(project.manifest) };
    };
    prepareAnalysisProjectTransaction = (_directory, project) => {
      validateAnalysisProjectManifest({ ...project.manifest, shards: [] });
      validateLoadedShards(project.shards, project.manifest);
      return { project };
    };
    committed = (manifest) => ({
      manifest,
      revision: analysisProjectRevision(manifest),
      maintenance: { removedBytes: 0, warnings: [] }
    });
    publish = (directory, project, expected, updates = project.shards) => {
      prepareAnalysisProjectTransaction(directory, project);
      fs4.mkdirSync(directory, { recursive: true });
      const exists = fs4.existsSync(import_node_path4.default.join(directory, ANALYSIS_PROJECT_MANIFEST));
      const store = exists ? openAnalysisProjectStore(directory) : new SqliteAnalysisStore(import_node_path4.default.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
      try {
        const manifest = store.transaction(() => {
          if (expected) assertAnalysisProjectRevision(store, expected);
          else if (store.revision() !== 0)
            throw new Error("Analysis project already exists; reload before publishing.");
          const evidenceIds = new Set(project.shards.evidence.map(({ id }) => id));
          const removedEvidence = updates.runtime === void 0 && updates.evidence !== void 0 && store.loadTable("evidence").some(({ id }) => !evidenceIds.has(id));
          store.replaceTables(updates);
          if (removedEvidence) store.validateRuntimeEvidence();
          return store.publishManifest(project.manifest);
        });
        store.writePointer(directory);
        return committed(manifest);
      } finally {
        store.close();
      }
    };
    commitAnalysisProjectViewUpdate = (directory, snapshot, updates) => {
      if ("runtime" in updates) throw new Error("Read-view updates cannot replace runtime history.");
      const project = {
        manifest: snapshot.manifest,
        shards: { ...snapshot.view, ...updates, runtime: [] }
      };
      const changed = {};
      for (const kind of Object.keys(updates)) {
        if (updates[kind] !== snapshot.view[kind]) Object.assign(changed, { [kind]: updates[kind] });
      }
      return publish(directory, project, snapshot.revision, changed);
    };
  }
});

// packages/disassembler/src/project-store.ts
var fs5, import_node_path5, parseAnalysisProjectManifest, openAnalysisProjectStore, loadProject, loadAnalysisProjectView;
var init_project_store = __esm({
  "packages/disassembler/src/project-store.ts"() {
    "use strict";
    fs5 = __toESM(require("node:fs"), 1);
    import_node_path5 = __toESM(require("node:path"), 1);
    init_project_types();
    init_project_validation();
    init_sqlite_records();
    init_sqlite_store();
    init_canonical_json();
    parseAnalysisProjectManifest = (input) => {
      if (!input || typeof input !== "object") throw new Error("Invalid analysis project manifest.");
      const manifest = input;
      if (manifest.schemaVersion > 3)
        throw new Error(
          `Analysis project schema ${manifest.schemaVersion} is newer than supported schema 3; refusing to downgrade.`
        );
      validateAnalysisProjectManifest(manifest);
      if (manifest.db !== "analysis.sqlite")
        throw new Error("Legacy analysis storage is no longer supported; use a SQLite project.");
      return manifest;
    };
    openAnalysisProjectStore = (directory) => {
      const manifest = parseAnalysisProjectManifest(
        JSON.parse(fs5.readFileSync(import_node_path5.default.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8"))
      );
      return new SqliteAnalysisStore(analysisProjectSqlitePath(directory, manifest), false);
    };
    loadProject = (directory, runtime, createProjection) => {
      const store = openAnalysisProjectStore(directory);
      try {
        return store.transaction(() => {
          const manifest = parseAnalysisProjectManifest(store.manifest());
          const shards = store.loadShards(false);
          validateLoadedShards(shards, manifest);
          if (!runtime && !createProjection) return { manifest, shards };
          const validate = createRuntimeRecordValidator(manifest, shards.evidence, false);
          const records = [];
          const projection = createProjection?.();
          try {
            for (const record of store.runtimeRecords()) {
              validate(record);
              if (projection) projection.push(record);
              else records.push(record);
            }
            if (!projection) records.sort(compareRuntimeRecordIds);
            return {
              manifest,
              shards: { ...shards, runtime: projection ? projection.finish() : records }
            };
          } finally {
            validate.close();
          }
        }, false);
      } finally {
        store.close();
      }
    };
    loadAnalysisProjectView = (directory, createProjection) => {
      const { manifest, shards } = loadProject(directory, false, createProjection);
      return { manifest, view: shards };
    };
  }
});

// packages/disassembler/src/runtime-trace.ts
var init_runtime_trace = __esm({
  "packages/disassembler/src/runtime-trace.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/execution-window.ts
var init_execution_window = __esm({
  "packages/disassembler/src/execution-window.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/instruction-annotations.ts
var sortedStrings, sortedNumbers, valueKey, locationKey, addValue, addAll, numberField, effectiveAddress, annotationState, runtimeState, buildInstructionAnalysisAnnotations;
var init_instruction_annotations = __esm({
  "packages/disassembler/src/instruction-annotations.ts"() {
    "use strict";
    init_canonical_json();
    sortedStrings = (values) => values ? [...new Set(values)].sort((left, right) => left.localeCompare(right)) : [];
    sortedNumbers = (values) => values ? [...new Set(values)].sort((left, right) => left - right) : [];
    valueKey = (value, present) => present ? JSON.stringify(canonicalValue(value)) : "<absent>";
    locationKey = (addressSpace, address3) => `${addressSpace}:${address3}`;
    addValue = (target, value) => {
      const values = target ?? /* @__PURE__ */ new Set();
      values.add(value);
      return values;
    };
    addAll = (target, values) => {
      if (values.length === 0) return target;
      target ??= /* @__PURE__ */ new Set();
      for (const value of values) target.add(value);
      return target;
    };
    numberField = (record, name) => {
      const value = record[name];
      return Number.isSafeInteger(value) && value >= 0 ? value : void 0;
    };
    effectiveAddress = (value) => {
      const operandIndex = numberField(value, "operandIndex");
      if (operandIndex === void 0 || typeof value.volatile !== "boolean" || typeof value.explanation !== "string") {
        return void 0;
      }
      const address3 = numberField(value, "address");
      const baseAddress = numberField(value, "baseAddress");
      const romOffset = numberField(value, "romOffset");
      const symbol = typeof value.symbol === "string" && value.symbol.length > 0 ? value.symbol : void 0;
      return {
        operandIndex,
        ...address3 === void 0 ? {} : { address: address3 },
        ...baseAddress === void 0 ? {} : { baseAddress },
        ...symbol === void 0 ? {} : { symbol },
        volatile: value.volatile,
        ...romOffset === void 0 ? {} : { romOffset },
        explanation: value.explanation
      };
    };
    annotationState = (annotation) => annotation.state;
    runtimeState = (record) => record.state;
    buildInstructionAnalysisAnnotations = (manifest, shards, runtime = () => shards.runtime) => {
      const fileAddressSpaces = new Set(
        manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
      );
      const instructions = /* @__PURE__ */ new Map();
      const diagnostics = [];
      const ensure = (addressSpace, address3) => {
        const key2 = locationKey(addressSpace, address3);
        let instruction = instructions.get(key2);
        if (!instruction) {
          instruction = {
            addressSpace,
            address: address3,
            executionCount: 0
          };
          instructions.set(key2, instruction);
        }
        return instruction;
      };
      const addStateObservation = (instruction, source, architecture, state, recordId, evidence, count) => {
        const stateKey = JSON.stringify(canonicalValue(state));
        const key2 = `${source}:${architecture}:${stateKey}`;
        const observations = instruction.stateObservations ??= /* @__PURE__ */ new Map();
        let observation = observations.get(key2);
        if (!observation) {
          observation = {
            source,
            architecture,
            state,
            stateKey,
            ...count === void 0 ? {} : { count: 0 },
            recordIds: /* @__PURE__ */ new Set(),
            evidence: /* @__PURE__ */ new Set()
          };
          observations.set(key2, observation);
        }
        if (count !== void 0) observation.count = (observation.count ?? 0) + count;
        observation.recordIds.add(recordId);
        addAll(observation.evidence, evidence);
        instruction.architectures = addValue(instruction.architectures, architecture);
        instruction.evidence = addAll(instruction.evidence, evidence);
      };
      const addNode = (node) => {
        const instruction = ensure(node.addressSpace, node.address);
        instruction.nodeIds = addValue(instruction.nodeIds, node.id);
        if (node.fileOffset !== void 0)
          instruction.outputOffsets = addValue(instruction.outputOffsets, node.fileOffset);
        instruction.evidence = addAll(instruction.evidence, node.evidence);
        for (const raw of node.effectiveAddresses) {
          const value = effectiveAddress(raw);
          if (!value) {
            diagnostics.push({
              recordId: node.id,
              message: "Ignored malformed effective-address metadata; required operandIndex, volatile, and explanation fields were not valid."
            });
            continue;
          }
          const key2 = JSON.stringify(canonicalValue(value));
          const addresses2 = instruction.effectiveAddresses ??= /* @__PURE__ */ new Map();
          let entry = addresses2.get(key2);
          if (!entry) {
            entry = { value, nodeIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
            addresses2.set(key2, entry);
          }
          entry.nodeIds.add(node.id);
          addAll(entry.evidence, node.evidence);
        }
        const before = node.incomingState;
        const after = node.outgoingState;
        for (const field of sortedStrings([...Object.keys(before), ...Object.keys(after)])) {
          const hasBefore = Object.hasOwn(before, field);
          const hasAfter = Object.hasOwn(after, field);
          const beforeValue = before[field];
          const afterValue = after[field];
          const beforeKey = valueKey(beforeValue, hasBefore);
          const afterKey = valueKey(afterValue, hasAfter);
          if (beforeKey === afterKey) continue;
          const key2 = `${field}:${beforeKey}:${afterKey}`;
          const transitions = instruction.stateTransitions ??= /* @__PURE__ */ new Map();
          let transition = transitions.get(key2);
          if (!transition) {
            transition = {
              field,
              beforeKey,
              afterKey,
              ...hasBefore ? { before: beforeValue } : {},
              ...hasAfter ? { after: afterValue } : {},
              nodeIds: /* @__PURE__ */ new Set(),
              evidence: /* @__PURE__ */ new Set()
            };
            transitions.set(key2, transition);
          }
          transition.nodeIds.add(node.id);
          addAll(transition.evidence, node.evidence);
        }
      };
      for (const record of shards.analysis) {
        if (record.kind === "cfg-node") addNode(record);
      }
      for (const annotation of shards.annotations) {
        if (annotation.classification !== "opcode") continue;
        const instruction = ensure(annotation.addressSpace, annotation.start);
        if (fileAddressSpaces.has(annotation.addressSpace)) {
          instruction.outputOffsets = addValue(instruction.outputOffsets, annotation.start);
        }
      }
      for (const record of runtime()) {
        if (record.kind === "runtime-execution") {
          const instruction = ensure(record.addressSpace, record.address);
          if (record.fileOffset !== void 0) {
            instruction.outputOffsets = addValue(instruction.outputOffsets, record.fileOffset);
          }
          instruction.architectures = addValue(instruction.architectures, record.architecture);
          instruction.executionCount += record.count;
          instruction.executionRecordIds = addValue(instruction.executionRecordIds, record.id);
          instruction.evidence = addAll(instruction.evidence, record.evidence);
        } else if (record.kind === "runtime-cpu-state") {
          const instruction = ensure(record.addressSpace, record.address);
          addStateObservation(
            instruction,
            "runtime",
            record.architecture,
            runtimeState(record),
            record.id,
            record.evidence,
            record.count
          );
        } else if (record.kind === "runtime-memory-access") {
          const instruction = ensure(record.instructionAddressSpace, record.instructionAddress);
          instruction.architectures = addValue(instruction.architectures, record.architecture);
          const value = {
            accessedAddressSpace: record.accessedAddressSpace,
            accessedAddress: record.accessedAddress,
            access: record.access,
            width: record.width,
            ...record.actor === void 0 ? {} : { actor: record.actor },
            ...record.channel === void 0 ? {} : { channel: record.channel },
            ...record.value === void 0 ? {} : { value: record.value }
          };
          const key2 = JSON.stringify(canonicalValue(value));
          const accesses = instruction.memoryAccesses ??= /* @__PURE__ */ new Map();
          let access = accesses.get(key2);
          if (!access) {
            access = { value, count: 0, recordIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
            accesses.set(key2, access);
          }
          access.count += record.count;
          access.recordIds.add(record.id);
          addAll(access.evidence, record.evidence);
          instruction.evidence = addAll(instruction.evidence, record.evidence);
        }
      }
      for (const comment of shards.comments) {
        const instruction = ensure(comment.addressSpace, comment.address);
        (instruction.comments ??= []).push(comment);
        for (const evidence of comment.evidence) (instruction.evidence ??= /* @__PURE__ */ new Set()).add(evidence);
      }
      const mutable = [...instructions.values()];
      const directIndex = /* @__PURE__ */ new Map();
      const outputIndex = [];
      for (const instruction of mutable) {
        const direct = directIndex.get(instruction.addressSpace);
        if (direct) direct.push(instruction);
        else directIndex.set(instruction.addressSpace, [instruction]);
        for (const offset of instruction.outputOffsets ?? []) outputIndex.push({ offset, instruction });
      }
      for (const values of directIndex.values()) {
        values.sort((left, right) => left.address - right.address);
      }
      outputIndex.sort((left, right) => left.offset - right.offset);
      const lowerBound2 = (values, target, at) => {
        let low = 0;
        let high = values.length;
        while (low < high) {
          const middle = low + Math.floor((high - low) / 2);
          if (at(values[middle]) < target) low = middle + 1;
          else high = middle;
        }
        return low;
      };
      const attachToRange = (addressSpace, start, end, callback) => {
        const direct = directIndex.get(addressSpace) ?? [];
        for (let index = lowerBound2(direct, start, ({ address: address3 }) => address3); index < direct.length && direct[index].address < end; index++) {
          callback(direct[index]);
        }
        if (fileAddressSpaces.has(addressSpace)) {
          for (let index = lowerBound2(outputIndex, start, ({ offset }) => offset); index < outputIndex.length && outputIndex[index].offset < end; index++) {
            const instruction = outputIndex[index].instruction;
            if (instruction.addressSpace === addressSpace && instruction.address >= start && instruction.address < end) {
              continue;
            }
            callback(instruction);
          }
        }
      };
      for (const annotation of shards.annotations) {
        attachToRange(annotation.addressSpace, annotation.start, annotation.end, (instruction) => {
          instruction.architectures = addValue(instruction.architectures, annotation.architecture);
          if (annotationState(annotation)) {
            addStateObservation(
              instruction,
              "project",
              annotation.architecture,
              annotationState(annotation),
              annotation.id,
              annotation.evidence
            );
          }
        });
      }
      const coverageById = /* @__PURE__ */ new Map();
      for (const record of runtime()) {
        if (record.kind !== "runtime-coverage") continue;
        coverageById.set(record.id, record);
        attachToRange(record.addressSpace, record.start, record.end, (instruction) => {
          instruction.architectures = addValue(instruction.architectures, record.architecture);
          instruction.coverageRecordIds = addValue(instruction.coverageRecordIds, record.id);
          instruction.evidence = addAll(instruction.evidence, record.evidence);
        });
      }
      const summaries3 = new Set(
        shards.analysis.filter((record) => record.kind === "summary").map(({ architecture }) => architecture)
      );
      if (summaries3.size === 1) {
        const [architecture] = summaries3;
        for (const instruction of mutable) {
          if (architecture && (instruction.architectures?.size ?? 0) === 0) {
            instruction.architectures = addValue(instruction.architectures, architecture);
          }
        }
      }
      const finalized = mutable.map((instruction) => {
        const coverage = /* @__PURE__ */ new Map();
        for (const recordId of instruction.coverageRecordIds ?? []) {
          const record = coverageById.get(recordId);
          const previous = coverage.get(record.coverage);
          coverage.set(record.coverage, {
            coverage: record.coverage,
            count: (previous?.count ?? 0) + record.count,
            recordIds: sortedStrings([...previous?.recordIds ?? [], record.id]),
            evidence: sortedStrings([...previous?.evidence ?? [], ...record.evidence])
          });
        }
        return {
          id: `instruction:${instruction.addressSpace}:${instruction.address}`,
          addressSpace: instruction.addressSpace,
          address: instruction.address,
          outputOffsets: sortedNumbers(instruction.outputOffsets),
          architectures: sortedStrings(instruction.architectures),
          nodeIds: sortedStrings(instruction.nodeIds),
          effectiveAddresses: [...instruction.effectiveAddresses?.values() ?? []].map(({ value, nodeIds, evidence }) => ({
            ...value,
            nodeIds: sortedStrings(nodeIds),
            evidence: sortedStrings(evidence)
          })).sort(
            (left, right) => left.operandIndex - right.operandIndex || (left.address ?? left.baseAddress ?? -1) - (right.address ?? right.baseAddress ?? -1) || left.explanation.localeCompare(right.explanation)
          ),
          stateTransitions: [...instruction.stateTransitions?.values() ?? []].sort(
            (left, right) => left.field.localeCompare(right.field) || left.beforeKey.localeCompare(right.beforeKey) || left.afterKey.localeCompare(right.afterKey)
          ).map(({ field, before, after, nodeIds, evidence }) => ({
            field,
            ...before === void 0 ? {} : { before },
            ...after === void 0 ? {} : { after },
            nodeIds: sortedStrings(nodeIds),
            evidence: sortedStrings(evidence)
          })),
          stateObservations: [...instruction.stateObservations?.values() ?? []].sort(
            (left, right) => left.source.localeCompare(right.source) || left.architecture.localeCompare(right.architecture) || left.stateKey.localeCompare(right.stateKey)
          ).map(({ source, architecture, state, count, recordIds, evidence }) => ({
            source,
            architecture,
            state,
            ...count === void 0 ? {} : { count },
            recordIds: sortedStrings(recordIds),
            evidence: sortedStrings(evidence)
          })),
          executionCount: instruction.executionCount,
          ...instruction.comments ? { comments: [...instruction.comments].sort((a, b) => a.id.localeCompare(b.id)) } : {},
          executionRecordIds: sortedStrings(instruction.executionRecordIds),
          runtimeCoverage: [...coverage.values()].sort(
            (left, right) => left.coverage.localeCompare(right.coverage)
          ),
          memoryAccesses: [...instruction.memoryAccesses?.values() ?? []].map(({ value, count, recordIds, evidence }) => ({
            ...value,
            count,
            recordIds: sortedStrings(recordIds),
            evidence: sortedStrings(evidence)
          })).sort(
            (left, right) => left.accessedAddressSpace.localeCompare(right.accessedAddressSpace) || left.accessedAddress - right.accessedAddress || left.access.localeCompare(right.access) || left.width - right.width || (left.value ?? -1) - (right.value ?? -1)
          ),
          evidence: sortedStrings(instruction.evidence)
        };
      });
      return {
        instructions: finalized.sort(
          (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
        ),
        diagnostics: diagnostics.sort(
          (left, right) => left.recordId.localeCompare(right.recordId) || left.message.localeCompare(right.message)
        )
      };
    };
  }
});

// packages/disassembler/src/runtime-evidence.ts
var init_runtime_evidence = __esm({
  "packages/disassembler/src/runtime-evidence.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/behavior-capture.ts
var MAX_CAPTURE_FILE_BYTES;
var init_behavior_capture = __esm({
  "packages/disassembler/src/behavior-capture.ts"() {
    "use strict";
    MAX_CAPTURE_FILE_BYTES = 128 * 1024 * 1024;
  }
});

// packages/disassembler/src/behavior-capture-recorder.ts
var init_behavior_capture_recorder = __esm({
  "packages/disassembler/src/behavior-capture-recorder.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/interval-index.ts
var HalfOpenIntervalIndex;
var init_interval_index = __esm({
  "packages/disassembler/src/interval-index.ts"() {
    "use strict";
    HalfOpenIntervalIndex = class {
      #entries;
      #prefixMaximumEnd;
      /**
       * Builds an immutable search index from already-owned interval values.
       * @param {readonly Value[]} values Non-negative safe half-open intervals in semantic input order.
       * @throws {Error} When an interval is empty, reversed, negative, or outside safe integers.
       */
      constructor(values) {
        for (const value of values) {
          if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 || value.end <= value.start) {
            throw new Error("Interval index entries must be non-negative safe half-open ranges.");
          }
        }
        this.#entries = values.map((value, inputIndex) => ({ value, inputIndex })).sort(
          (left, right) => left.value.start - right.value.start || left.value.end - right.value.end || left.inputIndex - right.inputIndex
        );
        const prefixMaximumEnd = [];
        let maximumEnd = -1;
        for (const [index, entry] of this.#entries.entries()) {
          maximumEnd = Math.max(maximumEnd, entry.value.end);
          prefixMaximumEnd[index] = maximumEnd;
        }
        this.#prefixMaximumEnd = prefixMaximumEnd;
      }
      /**
       * Returns every interval containing one safe non-negative point, in input order.
       * @param {number} point Safe non-negative point to query.
       * @returns {readonly Value[]} Matching intervals in their original input order.
       */
      at(point) {
        if (!Number.isSafeInteger(point) || point < 0) {
          throw new Error("Interval index points must be non-negative safe integers.");
        }
        return this.#matching(point, point + 1);
      }
      /**
       * Returns every interval intersecting a valid half-open query, in input order.
       * @param {number} start Inclusive safe non-negative query start.
       * @param {number} end Exclusive safe query end greater than `start`.
       * @returns {readonly Value[]} Matching intervals in their original input order.
       */
      overlapping(start, end) {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
          throw new Error("Interval index queries must be non-negative safe half-open ranges.");
        }
        return this.#matching(start, end);
      }
      #matching(start, end) {
        let low = 0;
        let high = this.#entries.length;
        while (low < high) {
          const middle = low + Math.floor((high - low) / 2);
          if (this.#entries[middle].value.start < end) low = middle + 1;
          else high = middle;
        }
        const matches = [];
        for (let index = low - 1; index >= 0 && this.#prefixMaximumEnd[index] > start; index--) {
          const entry = this.#entries[index];
          if (entry.value.end > start) matches.push(entry);
        }
        return matches.sort((left, right) => left.inputIndex - right.inputIndex).map(({ value }) => value);
      }
    };
  }
});

// packages/disassembler/src/sqlite-migration.ts
var import_node_sqlite3, RESERVE_BYTES;
var init_sqlite_migration = __esm({
  "packages/disassembler/src/sqlite-migration.ts"() {
    "use strict";
    import_node_sqlite3 = require("node:sqlite");
    RESERVE_BYTES = 256 * 1024 * 1024;
  }
});

// packages/disassembler/src/project-labels.ts
var validateSourceLabelName, legacySourceLabelName, projectSourceLabelNames;
var init_project_labels = __esm({
  "packages/disassembler/src/project-labels.ts"() {
    "use strict";
    validateSourceLabelName = (name) => {
      if (typeof name !== "string" || name.length > 256 || !/^[A-Z_a-z]\w*$/.test(name))
        throw new Error(
          "Use a global label name containing letters, digits, and underscores, starting with a letter or underscore."
        );
    };
    legacySourceLabelName = (name) => `L_${name.replaceAll(/\W/g, "_").replaceAll(/_+/g, "_") || "unnamed"}`;
    projectSourceLabelNames = (labels, reserved = []) => {
      const names = /* @__PURE__ */ new Map();
      const used = new Set([...reserved].map((name) => name.toLowerCase()));
      const sorted2 = [...labels].sort((a, b) => a.id.localeCompare(b.id));
      for (const label of sorted2.filter((label2) => label2.sourceName === void 0)) {
        const base = legacySourceLabelName(label.name);
        let name = base;
        let suffix = 2;
        while (used.has(name.toLowerCase())) name = `${base}_${suffix++}`;
        used.add(name.toLowerCase());
        names.set(label.id, name);
      }
      for (const label of sorted2.filter((label2) => label2.sourceName !== void 0)) {
        const name = label.sourceName;
        validateSourceLabelName(name);
        if (used.has(name.toLowerCase()))
          throw new Error(`Source label '${name}' conflicts with another symbol.`);
        used.add(name.toLowerCase());
        names.set(label.id, name);
      }
      return names;
    };
  }
});

// packages/disassembler/src/project-edit.ts
var isStableId2, manifestWithoutShards, assertStableId, recordMatches, sortedUnique2, assertManualEvidenceRequest, manualEvidence, addressSpaceMaximum, applyDisassemblyAnnotationEdit;
var init_project_edit = __esm({
  "packages/disassembler/src/project-edit.ts"() {
    "use strict";
    init_project_labels();
    init_project_store();
    isStableId2 = (id) => {
      const isAlphaNumeric = (character) => {
        const code = character.charCodeAt(0);
        return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
      };
      if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1))) return false;
      for (const character of id) {
        if (!isAlphaNumeric(character) && !"._:/-".includes(character)) return false;
      }
      return true;
    };
    manifestWithoutShards = (manifest) => {
      if (!("shards" in manifest)) return manifest;
      const { shards: ignored, ...projectManifest } = manifest;
      void ignored;
      return projectManifest;
    };
    assertStableId = (id, label) => {
      if (!isStableId2(id)) throw new Error(`${label} '${id}' is not a stable project id.`);
    };
    recordMatches = (left, right) => canonicalJson(left) === canonicalJson(right);
    sortedUnique2 = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
    assertManualEvidenceRequest = (project, evidenceId, sourceId) => {
      assertStableId(evidenceId, "Evidence id");
      assertStableId(sourceId, "Evidence source id");
      if (project.shards.evidence.some(({ id }) => id === evidenceId)) {
        throw new Error(`Evidence '${evidenceId}' already exists.`);
      }
    };
    manualEvidence = (evidenceId, sourceId, detail) => ({
      id: evidenceId,
      source: "manual",
      sourceId,
      confidence: "certain",
      ...detail?.trim() ? { detail: detail.trim() } : {}
    });
    addressSpaceMaximum = (project, addressSpaceId) => {
      const addressSpace = project.manifest.addressSpaces.find(({ id }) => id === addressSpaceId);
      if (!addressSpace) throw new Error(`Unknown analysis address space '${addressSpaceId}'.`);
      return addressSpace.kind === "file" ? project.manifest.rom.contentSize : 2 ** addressSpace.addressBits;
    };
    applyDisassemblyAnnotationEdit = (project, request2) => {
      assertManualEvidenceRequest(project, request2.evidenceId, request2.sourceId);
      const maximum = addressSpaceMaximum(project, request2.addressSpace);
      if (!Number.isSafeInteger(request2.address) || request2.address < 0 || request2.address >= maximum)
        throw new Error("The annotation address is outside the selected address space.");
      for (const text of [request2.comment, request2.inlineComment, request2.instructionComment]) {
        if (text === void 0) continue;
        if (typeof text !== "string") throw new Error("Comments must contain plain text.");
        for (const character of text) {
          const code = character.codePointAt(0);
          if (code < 32 && ![9, 10, 13].includes(code) || code === 8232 || code === 8233)
            throw new Error("Comments must contain plain text without control characters.");
        }
      }
      for (const text of [request2.inlineComment, request2.instructionComment]) {
        if (text !== void 0 && /[\n\r]/.test(text))
          throw new Error("Inline comments must fit on one line.");
      }
      const atAddress = (record) => record.addressSpace === request2.addressSpace && record.address === request2.address;
      const fileAddress = project.manifest.addressSpaces.some(
        (space) => space.id === request2.addressSpace && space.kind === "file"
      );
      const labelBefore = request2.labelId === void 0 ? void 0 : project.shards.labels.find(({ id }) => id === request2.labelId);
      if (labelBefore && !atAddress(labelBefore))
        throw new Error("The label id belongs to a different address.");
      let labelAfter;
      if (request2.name !== void 0) {
        if (!request2.labelId) throw new Error("A stable label id is required.");
        assertStableId(request2.labelId, "Label id");
        const name = request2.name.trim();
        validateSourceLabelName(name);
        labelAfter = {
          ...labelBefore ?? {
            id: request2.labelId,
            addressSpace: request2.addressSpace,
            address: request2.address,
            analysisEntryPoint: false
          },
          name,
          sourceName: name,
          ...request2.comment !== void 0 ? { comment: request2.comment.replaceAll("\r\n", "\n").replaceAll("\r", "\n") } : {},
          ...request2.inlineComment !== void 0 ? { inlineComment: request2.inlineComment } : {},
          evidence: sortedUnique2([...labelBefore?.evidence ?? [], request2.evidenceId])
        };
      } else if (request2.comment || request2.inlineComment || request2.labelId) {
        throw new Error("A label name is required for comments attached to a label.");
      }
      const labels = labelAfter ? [...project.shards.labels.filter(({ id }) => id !== labelAfter.id), labelAfter] : project.shards.labels;
      projectSourceLabelNames(labels);
      const commentBefore = request2.instructionCommentId === void 0 || request2.instructionComment === void 0 ? void 0 : project.shards.comments.find(({ id }) => id === request2.instructionCommentId);
      if (commentBefore && (!atAddress(commentBefore) || commentBefore.placement !== "inline-instruction"))
        throw new Error("The comment id belongs to a different address or placement.");
      let commentAfter;
      if (request2.instructionComment !== void 0) {
        if (!request2.instructionCommentId)
          throw new Error("A stable instruction-comment id is required.");
        assertStableId(request2.instructionCommentId, "Comment id");
        if (request2.instructionComment) {
          if (request2.instructionComment !== commentBefore?.text && !project.shards.analysis.some(
            (record) => record.kind === "cfg-node" && (atAddress(record) || fileAddress && record.fileOffset === request2.address)
          ))
            throw new Error("An inline instruction comment requires an accepted instruction boundary.");
          commentAfter = {
            id: request2.instructionCommentId,
            addressSpace: request2.addressSpace,
            address: request2.address,
            placement: "inline-instruction",
            text: request2.instructionComment,
            evidence: sortedUnique2([...commentBefore?.evidence ?? [], request2.evidenceId])
          };
        }
      }
      const withoutEvidence = (record) => {
        if (!record) return void 0;
        const { evidence: ignored, ...value } = record;
        void ignored;
        return value;
      };
      if (recordMatches(withoutEvidence(labelBefore), withoutEvidence(labelAfter)) && recordMatches(withoutEvidence(commentBefore), withoutEvidence(commentAfter)))
        throw new Error("The annotation has no changes to save.");
      const evidence = manualEvidence(
        request2.evidenceId,
        request2.sourceId,
        `Edited disassembly annotation at ${request2.addressSpace}:$${request2.address.toString(16).toUpperCase()}.`
      );
      return {
        project: {
          manifest: manifestWithoutShards(project.manifest),
          shards: {
            ...project.shards,
            labels,
            comments: request2.instructionComment === void 0 ? project.shards.comments : [
              ...project.shards.comments.filter(({ id }) => id !== request2.instructionCommentId),
              ...commentAfter ? [commentAfter] : []
            ],
            evidence: [...project.shards.evidence, evidence]
          }
        },
        inverse: {
          kind: "restore-disassembly-annotation",
          labelBefore,
          labelAfter,
          commentBefore,
          commentAfter,
          evidence
        }
      };
    };
  }
});

// packages/disassembler/src/rom-image.ts
var init_rom_image = __esm({
  "packages/disassembler/src/rom-image.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/runtime-trace-file.ts
var DEFAULT_RUNTIME_TRACE_MAX_BYTES, MAX_VALUE_CHARACTERS;
var init_runtime_trace_file = __esm({
  "packages/disassembler/src/runtime-trace-file.ts"() {
    "use strict";
    DEFAULT_RUNTIME_TRACE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
    MAX_VALUE_CHARACTERS = 32 * 1024 * 1024;
  }
});

// packages/disassembler/src/source-export.ts
var canonicalSourceExportJson;
var init_source_export = __esm({
  "packages/disassembler/src/source-export.ts"() {
    "use strict";
    init_canonical_json();
    canonicalSourceExportJson = (value) => canonicalJson(value);
  }
});

// packages/disassembler/src/static-analysis.ts
var init_static_analysis = __esm({
  "packages/disassembler/src/static-analysis.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/analysis-sources.ts
var sorted, key, addressKey2, hex, buildAnalysisSourceCatalog, AnalysisSourceIndex, compareLocations;
var init_analysis_sources = __esm({
  "packages/disassembler/src/analysis-sources.ts"() {
    "use strict";
    init_interval_index();
    init_project_labels();
    sorted = (values) => [...new Set(values)].sort();
    key = (...values) => JSON.stringify(values);
    addressKey2 = (space, address3) => key(space, address3);
    hex = (address3) => `$${address3.toString(16).toUpperCase().padStart(6, "0")}`;
    buildAnalysisSourceCatalog = (shards) => {
      const sources = /* @__PURE__ */ new Map();
      const ensure = (id, name, format, sha2562) => {
        let source = sources.get(id);
        if (!source) {
          source = {
            id,
            names: /* @__PURE__ */ new Set(),
            kinds: /* @__PURE__ */ new Set(),
            format,
            sha256: sha2562,
            evidenceIds: [],
            reports: []
          };
          sources.set(id, source);
        }
        source.names.add(name);
        return source;
      };
      const reportSources = /* @__PURE__ */ new Map();
      for (const report of shards.imports) {
        const id = key("artifact", report.format, report.sourceSha256);
        ensure(id, report.sourceName, report.format, report.sourceSha256).reports.push(report);
        reportSources.set(report.id, id);
      }
      for (const evidence of shards.evidence) {
        const artifact = evidence.artifact;
        const legacy = !artifact ? shards.imports.filter(
          (report) => report.id === evidence.id || report.sourceSha256 === evidence.sourceId
        ) : [];
        let id = key("producer", evidence.source, evidence.sourceId);
        if (artifact) id = key("artifact", artifact.format, artifact.sha256);
        else if (legacy.length === 1) id = reportSources.get(legacy[0].id);
        const source = sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
        source.kinds.add(evidence.source);
        source.evidenceIds.push(evidence.id);
      }
      return [...sources.values()].map((source) => ({
        ...source,
        names: sorted(source.names),
        name: sorted(source.names).join(" / "),
        kinds: [...source.kinds].sort(),
        evidenceIds: sorted(source.evidenceIds),
        reports: source.reports.sort((a, b) => a.id.localeCompare(b.id))
      })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    };
    AnalysisSourceIndex = class {
      sources;
      #sourceById;
      #owners = /* @__PURE__ */ new Map();
      #observations = /* @__PURE__ */ new Map();
      #coverage = /* @__PURE__ */ new Map();
      #memory = /* @__PURE__ */ new Map();
      #nodes = /* @__PURE__ */ new Map();
      #nodesAt = /* @__PURE__ */ new Map();
      #functionsAt = /* @__PURE__ */ new Map();
      #labelsAt = /* @__PURE__ */ new Map();
      #contributions = /* @__PURE__ */ new Map();
      #sourceInstructions = /* @__PURE__ */ new Map();
      #runtimeSources = /* @__PURE__ */ new Set();
      #comparisons = /* @__PURE__ */ new Map();
      #manifest;
      /** Build contribution indexes while streaming runtime rows; the input history is never retained. */
      constructor(manifest, shards, runtime = shards.runtime) {
        this.#manifest = manifest;
        this.sources = buildAnalysisSourceCatalog(shards);
        this.#sourceById = new Map(this.sources.map((source) => [source.id, source]));
        const sourceOfEvidence = new Map(
          this.sources.flatMap((source) => source.evidenceIds.map((id) => [id, source.id]))
        );
        const sourceSets = /* @__PURE__ */ new Map();
        const sourceIds = (evidence) => {
          const token = JSON.stringify(evidence);
          let ids = sourceSets.get(token);
          if (!ids) {
            ids = sorted(
              evidence.flatMap((id) => sourceOfEvidence.has(id) ? [sourceOfEvidence.get(id)] : [])
            );
            sourceSets.set(token, ids);
          }
          return ids;
        };
        for (const node of shards.analysis) {
          if (node.kind === "cfg-node") {
            this.#nodes.set(node.id, node);
            const location = addressKey2(node.addressSpace, node.address);
            const nodes = this.#nodesAt.get(location) ?? [];
            nodes.push(node);
            this.#nodesAt.set(location, nodes);
          } else if (node.kind === "function") {
            const location = addressKey2(node.addressSpace, node.address);
            const functions = this.#functionsAt.get(location) ?? [];
            functions.push(node);
            this.#functionsAt.set(location, functions);
          }
        }
        const names = projectSourceLabelNames(shards.labels);
        for (const label of shards.labels) {
          const location = addressKey2(label.addressSpace, label.address);
          this.#labelsAt.set(location, [
            ...this.#labelsAt.get(location) ?? [],
            names.get(label.id) ?? label.name
          ]);
        }
        const coverage = /* @__PURE__ */ new Map();
        for (const record of runtime) {
          const ids = sourceIds(record.evidence);
          for (const id of ids) this.#runtimeSources.add(id);
          if (record.kind === "runtime-execution" || record.kind === "runtime-instruction") {
            const location = key(record.architecture, record.addressSpace, record.address);
            let observation = this.#observations.get(location);
            if (!observation) {
              observation = {
                architecture: record.architecture,
                addressSpace: record.addressSpace,
                address: record.address,
                sources: /* @__PURE__ */ new Set(),
                sizes: /* @__PURE__ */ new Map(),
                bytes: /* @__PURE__ */ new Map(),
                mixedBytes: /* @__PURE__ */ new Set()
              };
              this.#observations.set(location, observation);
            }
            for (const id of ids) {
              observation.sources.add(id);
              const size = record.kind === "runtime-instruction" ? record.bytes.length : record.size ?? 0;
              observation.sizes.set(id, Math.max(size, observation.sizes.get(id) ?? 0));
            }
            if (record.kind === "runtime-instruction")
              for (const id of ids) {
                const prior = observation.bytes.get(id);
                if (!prior) observation.bytes.set(id, record.bytes);
                else if (prior.join(",") !== record.bytes.join(",")) observation.mixedBytes.add(id);
              }
          } else if (record.kind === "runtime-coverage" && record.coverage === "executed") {
            const location = key(record.architecture, record.addressSpace);
            const list = coverage.get(location) ?? [];
            list.push({ start: record.start, end: record.end, sources: ids });
            coverage.set(location, list);
          } else if (record.kind === "runtime-memory-access") {
            const identity = key(
              record.architecture,
              record.instructionAddressSpace,
              record.instructionAddress,
              record.accessedAddressSpace,
              record.accessedAddress,
              record.access,
              record.width,
              record.actor,
              record.channel
            );
            let site = this.#memory.get(identity);
            if (!site) {
              const description = `${record.access} ${record.accessedAddressSpace} ${hex(record.accessedAddress)} \xB7 ${record.width} byte(s) \xB7 ${record.actor ?? "unknown actor"}${record.channel === void 0 ? "" : ` ${record.channel}`}`;
              site = {
                sources: /* @__PURE__ */ new Set(),
                entry: {
                  id: identity,
                  label: hex(record.instructionAddress),
                  description,
                  detail: description,
                  addressSpace: record.instructionAddressSpace,
                  address: record.instructionAddress,
                  architecture: record.architecture,
                  outputOffsets: [],
                  recordIds: []
                }
              };
              this.#memory.set(identity, site);
            }
            for (const id of ids) site.sources.add(id);
          }
        }
        for (const [id, ranges] of coverage) this.#coverage.set(id, new HalfOpenIntervalIndex(ranges));
        for (const observation of this.#observations.values())
          for (const id of observation.sources) {
            const list = this.#sourceInstructions.get(id) ?? [];
            list.push(observation);
            this.#sourceInstructions.set(id, list);
          }
        for (const list of this.#sourceInstructions.values()) list.sort(compareLocations);
        const addContribution = (record, entry) => {
          for (const id of sourceIds(record.evidence)) {
            const list = this.#contributions.get(id) ?? [];
            list.push(entry);
            this.#contributions.set(id, list);
          }
        };
        for (const record of shards.labels)
          addContribution(record, {
            id: record.id,
            label: names.get(record.id) ?? record.name,
            description: `Label \xB7 ${record.addressSpace} ${hex(record.address)}`,
            detail: [record.comment, record.inlineComment].filter(Boolean).join("\n"),
            addressSpace: record.addressSpace,
            address: record.address,
            outputOffsets: [],
            recordIds: [record.id]
          });
        for (const record of shards.comments)
          addContribution(record, {
            id: record.id,
            label: record.text.split(/\r?\n/)[0],
            description: `Comment \xB7 ${record.addressSpace} ${hex(record.address)}`,
            detail: record.text,
            addressSpace: record.addressSpace,
            address: record.address,
            outputOffsets: [],
            recordIds: [record.id]
          });
        for (const record of shards.annotations)
          addContribution(record, {
            id: record.id,
            label: `${hex(record.start)}\u2013${hex(record.end - 1)}`,
            description: `${record.classification} \xB7 ${record.addressSpace} \xB7 ${record.end - record.start} bytes`,
            detail: `Classified interval from ${hex(record.start)} through ${hex(record.end - 1)}. This is attributed metadata, not proof of execution in this capture.`,
            addressSpace: record.addressSpace,
            address: record.start,
            architecture: record.architecture,
            outputOffsets: [],
            recordIds: [record.id]
          });
      }
      /**
       * Sources with recorded runtime facts; static/imported classifications are not capture baselines.
       * @returns {readonly AnalysisEvidenceSource[]} Sources contributing direct runtime facts.
       */
      runtimeSources() {
        return this.sources.filter((source) => this.#runtimeSources.has(source.id));
      }
      /**
       * Compare direct observations against all other captures or an explicit baseline selection.
       * @param {string} sourceId Selected catalog identity.
       * @param {readonly string[]} [baselineIds] Explicit baseline identities; undefined means all other runtime sources.
       * @returns {AnalysisSourceComparison} Compact counts and interpretation notes.
       */
      compare(sourceId, baselineIds) {
        return this.#comparison(sourceId, baselineIds).summary;
      }
      /**
       * Materialize only a bounded page for an editor tree.
       * @param {string} sourceId Selected source identity.
       * @param {AnalysisSourceGroup} group Contribution group.
       * @param {number} offset Zero-based page start.
       * @param {readonly string[]} [baselineIds] Optional comparison captures.
       * @returns {readonly AnalysisSourceEntry[]} Up to 200 navigable entries.
       */
      page(sourceId, group, offset = 0, baselineIds) {
        if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid source page offset.");
        const data = this.#comparison(sourceId, baselineIds);
        const slice = (entries3) => entries3.slice(offset, offset + 200);
        switch (group) {
          case "uniqueInstructions":
            return slice(data.unique).map((entry) => this.#instructionEntry(entry, sourceId));
          case "sharedInstructions":
            return slice(data.shared).map((entry) => this.#instructionEntry(entry, sourceId));
          case "codeRanges":
            return slice(data.ranges).map((range) => ({
              id: key(range.architecture, range.addressSpace, range.start),
              label: `${hex(range.start)}\u2013${hex(range.end - 1)}`,
              description: `${range.end - range.start} bytes \xB7 ${range.addressSpace}`,
              detail: "Known code extent at instruction addresses absent from the selected comparison captures. Addresses remain qualified by architecture and address space; this is not a ROM-file byte total.",
              addressSpace: range.addressSpace,
              address: range.start,
              architecture: range.architecture,
              outputOffsets: [],
              recordIds: []
            }));
          case "functions":
            return slice(data.functions);
          case "memory":
            return slice(data.memory);
          case "contributions":
            return slice(this.#contributions.get(sourceId) ?? []);
          default:
            throw new Error("Unknown source contribution group.");
        }
      }
      #matchingNodes(observation) {
        return (this.#nodesAt.get(addressKey2(observation.addressSpace, observation.address)) ?? []).filter(
          (node) => node.specificationId === observation.architecture || node.specificationId.startsWith(`${observation.architecture}.`)
        );
      }
      #size(observation, sourceId) {
        const captured = observation.sizes.get(sourceId) ?? 0;
        if (captured) return { size: captured, inferred: false };
        const sizes = new Set(this.#matchingNodes(observation).map(({ size }) => size));
        return sizes.size === 1 ? { size: [...sizes][0], inferred: true } : { size: 0, inferred: false };
      }
      #instructionEntry(observation, sourceId) {
        const nodes = this.#matchingNodes(observation);
        const { size, inferred } = this.#size(observation, sourceId);
        const labels = this.#labelsAt.get(addressKey2(observation.addressSpace, observation.address));
        const mnemonic = sorted(nodes.map(({ mnemonic: mnemonic2 }) => mnemonic2)).join(" / ");
        const bytes = observation.bytes.get(sourceId);
        const name = labels?.length ? labels.join(" / ") : mnemonic;
        return {
          id: key(observation.architecture, observation.addressSpace, observation.address),
          label: `${hex(observation.address)}${name ? ` ${name}` : ""}`,
          description: `${observation.addressSpace} \xB7 ${size ? `${size} byte(s)${inferred ? " (analysis)" : ""}` : "size unknown"}`,
          detail: [
            `${observation.architecture} \xB7 ${observation.addressSpace} ${hex(observation.address)}`,
            `Observed in: ${sorted(observation.sources).map((id) => this.#sourceById.get(id)?.name ?? id).join(", ")}`,
            bytes ? `Captured bytes${observation.mixedBytes.has(sourceId) ? " (one of multiple variants)" : ""}: ${bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")}` : "No execution-time bytes were saved.",
            inferred ? "Byte extent uses the single agreed instruction size in the current analysis." : ""
          ].filter(Boolean).join("\n"),
          addressSpace: observation.addressSpace,
          address: observation.address,
          architecture: observation.architecture,
          outputOffsets: [
            ...new Set(
              nodes.flatMap((node) => node.fileOffset === void 0 ? [] : [node.fileOffset])
            )
          ],
          recordIds: nodes.slice(0, 32).map(({ id }) => id)
        };
      }
      #ownerIds(node) {
        const cached = this.#owners.get(node.id);
        if (cached) return cached;
        const path9 = node.evidencePath.length ? node.evidencePath : [node.id];
        for (let index = path9.length - 1; index >= 0; index--) {
          const parent = this.#nodes.get(path9[index]);
          if (!parent) continue;
          const owners = this.#functionsAt.get(addressKey2(parent.addressSpace, parent.address));
          if (owners?.length) {
            const ids = sorted(owners.map(({ id }) => id));
            this.#owners.set(node.id, ids);
            return ids;
          }
        }
        this.#owners.set(node.id, []);
        return [];
      }
      #comparison(sourceId, baselineIds) {
        const source = this.#sourceById.get(sourceId);
        if (!source)
          throw new Error("This source no longer exists. Refresh Sources and select it again.");
        const ids = sorted(baselineIds ?? [...this.#runtimeSources].filter((id) => id !== sourceId));
        if (ids.some((id) => id === sourceId || !this.#sourceById.has(id)))
          throw new Error("Invalid source comparison selection.");
        const token = key(sourceId, JSON.stringify(ids));
        const cached = this.#comparisons.get(token);
        if (cached) return cached;
        const baseline = new Set(ids);
        const observations = this.#sourceInstructions.get(sourceId) ?? [];
        const unique = [], shared = [];
        for (const observation of observations) {
          const aggregate = this.#coverage.get(key(observation.architecture, observation.addressSpace))?.at(observation.address) ?? [];
          const present = ids.some((id) => observation.sources.has(id)) || aggregate.some((range) => range.sources.some((id) => baseline.has(id)));
          (present ? shared : unique).push(observation);
        }
        const ranges = [];
        const functions = /* @__PURE__ */ new Map();
        const functionById = new Map([...this.#functionsAt.values()].flat().map((fn) => [fn.id, fn]));
        let unknownSizeInstructions = 0, unownedInstructions = 0, ambiguousInstructions = 0, inferred = 0;
        for (const observation of unique) {
          const size = this.#size(observation, sourceId);
          if (size.inferred) inferred++;
          const maximum = this.#manifest.addressSpaces.find(
            ({ id }) => id === observation.addressSpace
          );
          let limit = maximum ? 2 ** maximum.addressBits : 0;
          if (maximum?.kind === "file") limit = this.#manifest.rom.contentSize;
          if (size.size && observation.address + size.size <= limit) {
            const prior = ranges.at(-1);
            if (prior && prior.architecture === observation.architecture && prior.addressSpace === observation.addressSpace && prior.end >= observation.address)
              prior.end = Math.max(prior.end, observation.address + size.size);
            else
              ranges.push({
                architecture: observation.architecture,
                addressSpace: observation.addressSpace,
                start: observation.address,
                end: observation.address + size.size
              });
          } else unknownSizeInstructions++;
          const nodes = this.#matchingNodes(observation);
          const owners = sorted(nodes.flatMap((node) => this.#ownerIds(node)));
          if (!owners.length) unownedInstructions++;
          else if (owners.length !== 1 || nodes.some((node) => !this.#ownerIds(node).length))
            ambiguousInstructions++;
          else {
            const fn = functionById.get(owners[0]);
            const prior = functions.get(fn.id);
            functions.set(fn.id, {
              fn,
              count: (prior?.count ?? 0) + 1,
              architecture: observation.architecture
            });
          }
        }
        const functionEntries = [...functions.values()].sort(
          (a, b) => b.count - a.count || a.fn.address - b.fn.address || a.fn.id.localeCompare(b.fn.id)
        ).map(({ fn, count, architecture }) => ({
          id: fn.id,
          label: this.#labelsAt.get(addressKey2(fn.addressSpace, fn.address))?.join(" / ") ?? `Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`,
          description: `${count} unique instruction(s) \xB7 ${hex(fn.address)}`,
          detail: "Contains instruction addresses observed only in the selected source relative to the chosen baseline. Other parts of this function may be shared.",
          addressSpace: fn.addressSpace,
          address: fn.address,
          architecture,
          outputOffsets: [],
          recordIds: [fn.id]
        }));
        const memory = [...this.#memory.values()].filter(
          (site) => site.sources.has(sourceId) && ![...site.sources].some((id) => baseline.has(id))
        ).map(({ entry }) => entry).sort((a, b) => a.address - b.address || a.id.localeCompare(b.id));
        const summary = {
          source,
          baseline: ids.map((id) => this.#sourceById.get(id)),
          instructionCount: observations.length,
          uniqueInstructionCount: unique.length,
          sharedInstructionCount: shared.length,
          knownCodeBytes: ranges.reduce((sum, range) => sum + range.end - range.start, 0),
          unknownSizeInstructions,
          functionCount: functionEntries.length,
          unownedInstructions,
          ambiguousInstructions,
          uniqueMemoryCount: memory.length,
          contributionCount: this.#contributions.get(sourceId)?.length ?? 0,
          codeRangeCount: ranges.length,
          notes: [
            "Unique means an instruction start was recorded here and absent from execution observations/coverage in the selected comparison captures. It does not prove behavior-exclusive logic.",
            "Code byte totals merge known extents at unique instruction starts within each architecture/address space. They are not a delta of ROM file bytes or byte values; mirrored addresses stay separate.",
            "Static analysis and imported byte classifications do not count as captured execution. Labels, comments and classifications below show attribution, not exclusivity.",
            ...inferred ? [
              `${inferred} unique instruction(s) use an agreed analysis size because their capture saved only PCs.`
            ] : [],
            ...unknownSizeInstructions ? [
              `${unknownSizeInstructions} unique instruction(s) have an unknown or unprojectable size and are excluded from the byte total.`
            ] : [],
            ...!ids.length ? ["No comparison captures selected; all observed instruction addresses are shown."] : [],
            ...[source, ...ids.map((id) => this.#sourceById.get(id))].flatMap(
              (entry) => entry.reports.flatMap((report) => [
                ...report.warnings.map((warning) => `${entry.name}: ${warning}`),
                ...report.unsupported.map(
                  (loss) => `${entry.name}: ${loss.count} ${loss.field} omitted. ${loss.reason}`
                )
              ])
            )
          ]
        };
        const data = { summary, unique, shared, ranges, functions: functionEntries, memory };
        if (this.#comparisons.size >= 4)
          this.#comparisons.delete(this.#comparisons.keys().next().value);
        this.#comparisons.set(token, data);
        return data;
      }
    };
    compareLocations = (a, b) => a.architecture.localeCompare(b.architecture) || a.addressSpace.localeCompare(b.addressSpace) || a.address - b.address;
  }
});

// packages/disassembler/src/runtime-trace-project.ts
var init_runtime_trace_project = __esm({
  "packages/disassembler/src/runtime-trace-project.ts"() {
    "use strict";
  }
});

// packages/disassembler/src/index.ts
var init_src = __esm({
  "packages/disassembler/src/index.ts"() {
    "use strict";
    init_asset_codec();
    init_asset_codecs();
    init_asset_preview();
    init_analysis_graph();
    init_compression_codec();
    init_coverage_map();
    init_execution_window();
    init_instruction_annotations();
    init_behavior_capture();
    init_behavior_capture_recorder();
    init_interval_index();
    init_sqlite_store();
    init_sqlite_migration();
    init_project_store();
    init_project_transaction();
    init_project_edit();
    init_project_labels();
    init_project_types();
    init_rom_image();
    init_runtime_evidence();
    init_runtime_trace();
    init_runtime_trace_file();
    init_source_export();
    init_static_analysis();
    init_trace_detail();
    init_analysis_sources();
    init_runtime_trace_project();
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
  "node_modules/semver/internal/constants.js"(exports2, module2) {
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
    module2.exports = {
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
  "node_modules/semver/internal/debug.js"(exports2, module2) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module2.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports2, module2) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports2 = module2.exports = {};
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var safeSrc = exports2.safeSrc = [];
    var t = exports2.t = {};
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
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports2, module2) {
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
    module2.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports2, module2) {
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
    module2.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports2, module2) {
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
    module2.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports2, module2) {
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
    module2.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module2.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module2.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports2, module2) {
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
    module2.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports2, module2) {
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
    module2.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module2.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module2.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module2.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module2.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module2.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module2.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module2.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module2.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module2.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module2.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module2.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module2.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module2.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module2.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module2.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module2.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports2, module2) {
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
    module2.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports2, module2) {
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
    module2.exports = coerce;
  }
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS({
  "node_modules/semver/functions/truncate.js"(exports2, module2) {
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
    module2.exports = truncate;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key2) {
        const value = this.map.get(key2);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key2);
          this.map.set(key2, value);
          return value;
        }
      }
      delete(key2) {
        return this.map.delete(key2);
      }
      set(key2, value) {
        const deleted = this.delete(key2);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key2, value);
        }
        return this;
      }
    };
    module2.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports2, module2) {
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
    module2.exports = Range;
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
  "node_modules/semver/classes/comparator.js"(exports2, module2) {
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
    module2.exports = Comparator;
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
  "node_modules/semver/functions/satisfies.js"(exports2, module2) {
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
    module2.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module2.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports2, module2) {
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
    module2.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports2, module2) {
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
    module2.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports2, module2) {
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
    module2.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module2.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports2, module2) {
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
    module2.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module2.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module2.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module2.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports2, module2) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module2.exports = (versions, range, options) => {
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
  "node_modules/semver/ranges/subset.js"(exports2, module2) {
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
    module2.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports2, module2) {
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
    module2.exports = {
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
      writeValue: (value, width2, endianness) => context.emission.writeValue(value, width2, endianness),
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
var init_decoder_types = __esm({
  "packages/core/src/decoder-types.ts"() {
    "use strict";
  }
});

// packages/core/src/debug-map.ts
var import_node_crypto4, DEBUG_MAP_FORMAT, DEBUG_MAP_SCHEMA_VERSION, canonicalValue2, canonicalDebugMapJson, sha256, validateDebugMap;
var init_debug_map = __esm({
  "packages/core/src/debug-map.ts"() {
    "use strict";
    import_node_crypto4 = require("node:crypto");
    DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
    DEBUG_MAP_SCHEMA_VERSION = 1;
    canonicalValue2 = (value) => {
      if (Array.isArray(value)) return value.map(canonicalValue2);
      if (value !== null && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key2, entry]) => [key2, canonicalValue2(entry)])
        );
      }
      return value;
    };
    canonicalDebugMapJson = (value) => `${JSON.stringify(canonicalValue2(value), null, 2)}
`;
    sha256 = (value) => (0, import_node_crypto4.createHash)("sha256").update(value).digest("hex");
    validateDebugMap = (map, output) => {
      const { fingerprint, ...payload } = map;
      const issues = [];
      if (map.format !== DEBUG_MAP_FORMAT)
        issues.push(`Unsupported debug-map format '${String(map.format)}'.`);
      if (map.schemaVersion !== DEBUG_MAP_SCHEMA_VERSION)
        issues.push(`Unsupported debug-map schema ${String(map.schemaVersion)}.`);
      const actualFingerprint = sha256(canonicalDebugMapJson(payload));
      if (fingerprint.algorithm !== "sha256" || fingerprint.value !== actualFingerprint)
        issues.push("Debug-map fingerprint mismatch.");
      if (output) {
        if (output.length !== map.output.size) issues.push("Debug-map output size mismatch.");
        if (sha256(output) !== map.output.sha256) issues.push("Debug-map output SHA-256 mismatch.");
      }
      return issues;
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
var init_src2 = __esm({
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
var flagValue, resolvedWidthFlag, readLittleEndian, signed, bankLocalTarget, addressOperand, operandsFor, targetFor, referencesFor3, effectsFor, buildInstruction, Cpu65816Decoder;
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
      const width2 = flagValue(state[flag]);
      if (width2 === 1) return 1;
      if (width2 === 0 && emulation === 0) return 0;
      return "unknown";
    };
    readLittleEndian = (bytes, offset, width2) => {
      let value = 0;
      for (let index = 0; index < width2; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
      return value >>> 0;
    };
    signed = (value, width2) => {
      const signBit = 1 << width2 * 8 - 1;
      const modulus = 2 ** (width2 * 8);
      return value & signBit ? value - modulus : value;
    };
    bankLocalTarget = (logicalAddress, size, displacement) => logicalAddress & 16711680 | logicalAddress + size + displacement & 65535;
    addressOperand = (value, width2) => ({
      kind: "address",
      value,
      width: width2
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
    referencesFor3 = (specification2, operands, state, logicalAddress) => {
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
        references: referencesFor3(specification2, operands, state, context.logicalAddress),
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
          const width2 = resolvedWidthFlag(state, specification2.widthFlag);
          sizes = width2 === "unknown" ? [2, 3] : [width2 === 1 ? 2 : 3];
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
    init_src2();
  }
});

// packages/plugin-snes/src/architectures/65816.ts
var lower65816Operand, keepsFixedWidthAddressingMode, isIndexedMemory, Arch65816;
var init__ = __esm({
  "packages/plugin-snes/src/architectures/65816.ts"() {
    "use strict";
    init_src2();
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
            const width2 = this.immediateBytes(opcode, len, explicitlen, rawOperand);
            const value = this.assembler.operandResolver.getnum(resolvedOperand);
            if (width2 === 1) {
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
        let address3 = 0;
        let mode3;
        if (loweredOperand.immediate) {
          mode3 = "immediate";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
          this.assembler.write1(opcodes[logicOpcode].immediate);
          const width2 = this.immediateBytes(opcode, len, explicitlen, rawOperand);
          if (width2 === 1) {
            this.assembler.write1(address3);
          } else {
            this.assembler.write2(address3);
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
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absoluteIndexedY" && opcodes[logicOpcode].absoluteY) {
          mode3 = "absoluteY";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absoluteLong") {
          mode3 = "absoluteLong";
          address3 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else if (loweredOperand.mode === "absoluteLongIndexedX" && opcodes[logicOpcode].absoluteLongX) {
          mode3 = "absoluteLongX";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "stackRelative" && opcodes[logicOpcode].stackRelative) {
          mode3 = "stackRelative";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "stackRelativeIndexedIndirectY" && opcodes[logicOpcode].stackRelativeIndirectY) {
          mode3 = "stackRelativeIndirectY";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (/^\$[\dA-Fa-f]{2}$/.test(resolvedOperand)) {
          mode3 = "direct";
          address3 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else if (loweredOperand.mode === "directPageIndexedX" && opcodes[logicOpcode].directX) {
          mode3 = "directX";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indexedIndirectX") {
          mode3 = "indirectX";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectIndexedY") {
          mode3 = "indirectY";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "directPageIndirect") {
          mode3 = "indirect";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLong" && opcodes[logicOpcode].directIndirectLong) {
          mode3 = "directIndirectLong";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLongIndexedY" && opcodes[logicOpcode].directIndirectLongY) {
          mode3 = "directIndirectLongY";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLong") {
          mode3 = "indirectLong";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLongIndexedY") {
          mode3 = "indirectLongY";
          address3 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absolute") {
          mode3 = "absolute";
          address3 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else {
          throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
        }
        const opcodeByte = opcodes[logicOpcode][mode3];
        if (!opcodeByte) {
          throw new Error(`Error: Invalid operand format for ${opcode}: ${operand} => ${opcodeByte}`);
        }
        this.assembler.write1(opcodeByte);
        if ((opcode === "AND" || opcode === "ORA" || opcode === "EOR" || opcode === "CPY" || opcode === "CPX" || opcode === "CMP") && mode3 === "directIndirectLong") {
          this.assembler.write1(address3);
        } else if (["absolute", "absoluteX", "absoluteY", "directIndirectLong"].includes(mode3)) {
          this.assembler.write2(address3);
        } else if (["absoluteLong", "absoluteLongX", "indirectLong", "indirectLongY"].includes(mode3)) {
          this.assembler.write3(address3);
        } else {
          this.assembler.write1(address3);
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
        let address3 = 0;
        const isLDX = opcode === "LDX";
        const isLDY = opcode === "LDY";
        if (operand.startsWith("#")) {
          if (isLDX) {
            opcodeByte = 162;
          } else if (isLDY) {
            opcodeByte = 160;
          }
          address3 = this.assembler.operandResolver.getnum(operand.slice(1));
          this.assembler.write1(opcodeByte);
          const width2 = this.immediateBytes(opcode, len, explicitlen, operand);
          if (width2 === 1) {
            this.assembler.write1(address3);
          } else {
            this.assembler.write2(address3);
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
          address3 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(opcodeByte);
          if (len === 1) {
            this.assembler.write1(address3);
          } else if (len === 2) {
            this.assembler.write2(address3);
          } else {
            throw new Error(`Forced length ${len} not supported for ${opcode}`);
          }
          return true;
        }
        if (isLDX) {
          if (!isIndexed) {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address3 > 255) {
              opcodeByte = 174;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address3);
            } else {
              opcodeByte = 166;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address3);
            }
          } else {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absoluteIndexedY" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address3 > 255) {
              opcodeByte = 190;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address3);
            } else {
              opcodeByte = 182;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address3);
            }
          }
        } else if (isLDY) {
          if (!isIndexed) {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address3 > 255) {
              opcodeByte = 172;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address3);
            } else {
              opcodeByte = 164;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address3);
            }
          } else {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absoluteIndexedX" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address3 > 255) {
              opcodeByte = 188;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address3);
            } else {
              opcodeByte = 180;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address3);
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
        let address3 = 0;
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
          ({ mode: mode3, address: address3 } = selectDirectJumpMode(
            opcode,
            this.assembler.operandResolver.getnum(operand)
          ));
        } else if (/^\$[\dA-Fa-f]{1,6}$/.test(operand)) {
          ({ mode: mode3, address: address3 } = selectDirectJumpMode(
            opcode,
            this.assembler.operandResolver.getnum(operand)
          ));
        } else if (loweredOperand.mode === "indirectLong") {
          mode3 = "JMP_INDIRECT_LONG";
          address3 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
        } else if (opcode === "JSR" && loweredOperand.mode === "indexedIndirectX") {
          address3 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JSR_INDEXED_INDIRECT";
        } else if (loweredOperand.mode === "indexedIndirectX") {
          address3 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JMP_INDEXED_INDIRECT";
        } else if (loweredOperand.mode === "directPageIndirect") {
          address3 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JMP_INDIRECT";
        } else {
          try {
            ({ mode: mode3, address: address3 } = selectDirectJumpMode(
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
            this.assembler.write3(address3);
          } else {
            this.assembler.write2(address3);
          }
        } else if (mode3 in jumpIndirectOpcodes) {
          this.assembler.write1(jumpIndirectOpcodes[mode3]);
          this.assembler.write2(address3);
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
        const address3 = offset;
        this.assembler.write1(98);
        this.assembler.write2(address3);
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
        let address3 = 0;
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
          address3 = this.assembler.operandResolver.getnum(operand);
          if (len === 1) {
            this.assembler.write1(address3);
          } else if (len === 2) {
            this.assembler.write2(address3);
          } else {
            throw new Error(`Forced length ${len} not supported for ${opcode}`);
          }
          return true;
        }
        if (loweredOperand.mode === "directPageIndexedX" && storeModeMap.directX && /^\$[\da-f]{2}$/i.test(operand)) {
          address3 = this.assembler.operandResolver.getnum(operand);
        } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect && storeModeMap.directY) {
          address3 = this.assembler.operandResolver.getnum(operand);
        } else if (loweredOperand.mode === "absoluteIndexedX" && storeModeMap.absoluteX) {
          address3 = this.assembler.operandResolver.getnum(operand);
        }
        if (!isIndexed && (loweredOperand.mode === "absolute" || /^\$[\dA-Fa-f]{3,4}$/.test(operand))) {
          address3 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address3);
          return true;
        } else if (!isIndexed && /^\$[\dA-Fa-f]{2}$/.test(operand)) {
          address3 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(storeOpcodes[storeOpcode].direct);
          this.assembler.write1(address3);
          return true;
        } else if (isIndexed) {
          if (storeOpcode === "STX") {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand)) {
              this.assembler.write1(storeOpcodes[storeOpcode].absolute);
              this.assembler.write2(address3);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directY);
              this.assembler.write1(address3);
            }
            return true;
          } else if (storeOpcode === "STY") {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand)) {
              this.assembler.write1(storeOpcodes[storeOpcode].absolute);
              this.assembler.write2(address3);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directX);
              this.assembler.write1(address3);
            }
            return true;
          } else if (storeOpcode === "STZ") {
            address3 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand) && storeOpcodes[storeOpcode].absoluteX) {
              this.assembler.write1(storeOpcodes[storeOpcode].absoluteX);
              this.assembler.write2(address3);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directX);
              this.assembler.write1(address3);
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
        let address3 = 0;
        let outLength = 0;
        if (operand.startsWith("#")) {
          address3 = this.assembler.operandResolver.getnum(operand.slice(1));
          if (explicitlen) {
            const immediate4 = forcedMaps[bitOpcode].immediate;
            if (immediate4 === void 0) {
              throw new Error(`Opcode ${opcode} does not support immediate mode.`);
            }
            this.assembler.write1(immediate4);
            outLength = len === 1 ? 1 : 2;
          } else {
            const immediate4 = opcodes[bitOpcode].immediate;
            if (immediate4 === void 0) {
              throw new Error(`Opcode ${opcode} does not support immediate mode.`);
            }
            this.assembler.write1(immediate4);
            outLength = operand.length === 6 ? 2 : 1;
          }
        } else {
          const isIndexed = isIndexedMemory(loweredOperand, "x");
          address3 = this.assembler.operandResolver.getnum(normalizedOperand);
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
          this.assembler.write1(address3);
        } else if (outLength === 2) {
          this.assembler.write2(address3);
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
          const address3 = this.assembler.operandResolver.getnum(operand);
          const opcodeByte = loweredOperand.mode === "absolute" || operand.length === 5 ? memoryBitOpcodes[opcode].absolute : memoryBitOpcodes[opcode].direct;
          this.assembler.write1(opcodeByte);
          if (opcodeByte === memoryBitOpcodes[opcode].absolute) {
            this.assembler.write2(address3);
          } else {
            this.assembler.write1(address3);
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
var readLittleEndian2, signedByte, register2, address, immediate, bit, relative, bitAddress, fixedRegisters, operandsFor2, referencesFor4, buildInstruction2, Spc700Decoder;
var init_spc700_decoder = __esm({
  "packages/plugin-snes/src/architectures/spc700-decoder.ts"() {
    "use strict";
    init_spc700_spec();
    readLittleEndian2 = (bytes, offset, width2) => {
      let value = 0;
      for (let index = 0; index < width2; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
      return value >>> 0;
    };
    signedByte = (value) => value & 128 ? value - 256 : value;
    register2 = (name) => ({ kind: "register", register: name });
    address = (value, width2) => ({
      kind: "address",
      value,
      width: width2
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
      return [address(encoded & 8191, 2), bit(encoded >>> 13)];
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
          return [address(byte, 1), bit(Number(specification2.mnemonic.at(-1)))];
        case "directBitRelative":
          return [
            address(byte, 1),
            bit(Number(specification2.mnemonic.at(-1))),
            relative(bytes[2] ?? 0, logicalAddress, bytes.length)
          ];
        case "accumulatorDirect":
        case "accumulatorDirectIndexedX":
        case "accumulatorDirectIndexedXIndirect":
        case "accumulatorDirectIndirectIndexedY":
          return [register2("A"), address(byte, 1)];
        case "accumulatorAbsolute":
        case "accumulatorAbsoluteIndexedX":
        case "accumulatorAbsoluteIndexedY":
          return [register2("A"), address(word2, 2)];
        case "accumulatorIndirectX":
          return [register2("A"), register2("X")];
        case "accumulatorImmediate":
          return [register2("A"), immediate(byte)];
        case "directDirect":
          return [address(bytes[2] ?? 0, 1), address(byte, 1)];
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
          return [address(byte, 1)];
        case "absolute":
        case "absoluteIndexedXIndirect":
          return [address(word2, 2)];
        case "relative":
          return [relative(byte, logicalAddress, bytes.length)];
        case "absoluteAccumulator":
          return [address(word2, 2), register2("A")];
        case "directImmediate":
          return [address(bytes[2] ?? 0, 1), immediate(byte)];
        case "registerXAbsolute":
          return [register2("X"), address(word2, 2)];
        case "registerXDirect":
        case "registerXDirectIndexedY":
          return [register2("X"), address(byte, 1)];
        case "registerYAbsolute":
          return [register2("Y"), address(word2, 2)];
        case "registerYDirect":
        case "registerYDirectIndexedX":
          return [register2("Y"), address(byte, 1)];
        case "registerXImmediate":
          return [register2("X"), immediate(byte)];
        case "registerYImmediate":
          return [register2("Y"), immediate(byte)];
        case "directRelative":
        case "directIndexedXRelative":
          return [address(byte, 1), relative(bytes[2] ?? 0, logicalAddress, bytes.length)];
        case "registerYRelative":
          return [register2("Y"), relative(byte, logicalAddress, bytes.length)];
        case "registerYADirect":
          return [register2("YA"), address(byte, 1)];
        case "directRegisterYA":
          return [address(byte, 1), register2("YA")];
        case "upperPageCall":
          return [address(65280 | byte, 2)];
        case "directRegisterA":
        case "directIndexedXRegisterA":
        case "directIndirectIndexedYRegisterA":
        case "directIndexedXIndirectRegisterA":
          return [address(byte, 1), register2("A")];
        case "absoluteRegisterA":
        case "absoluteIndexedXRegisterA":
        case "absoluteIndexedYRegisterA":
          return [address(word2, 2), register2("A")];
        case "indirectXRegisterA":
          return [register2("X"), register2("A")];
        case "directRegisterX":
        case "directIndexedYRegisterX":
          return [address(byte, 1), register2("X")];
        case "absoluteRegisterX":
          return [address(word2, 2), register2("X")];
        case "directRegisterY":
        case "directIndexedXRegisterY":
          return [address(byte, 1), register2("Y")];
        case "absoluteRegisterY":
          return [address(word2, 2), register2("Y")];
        default:
          throw new Error(`Unhandled SPC700 decode mode '${specification2.mode}'.`);
      }
    };
    referencesFor4 = (specification2, operands, state) => {
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
        references: referencesFor4(specification2, operands, context.state ?? {}),
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
      let current2 = "";
      for (const character of text) {
        if (character === "(") level++;
        if (character === ")") level--;
        if (character === "," && level === 0) {
          operands.push(current2.trim());
          current2 = "";
        } else {
          current2 += character;
        }
      }
      if (current2.trim()) operands.push(current2.trim());
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
    init_src2();
    init_instruction_catalog2();
    init_operand_classifiers();
    init_split_operands();
    lowerSpc700Operand = (resolver, operand) => {
      const lowered = resolver.lowerOperand(operand);
      return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
    };
    hasOwn = (obj, key2) => Object.hasOwn(obj, key2);
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
          const key2 = (loweredOperand?.registerName ?? operand).toUpperCase();
          if (hasOwn(pushMap, key2)) {
            this.assembler.write1(pushMap[key2]);
            return true;
          }
        }
        if (opcode.toUpperCase() === "POP") {
          const key2 = (loweredOperand?.registerName ?? operand).toUpperCase();
          if (hasOwn(popMap, key2)) {
            this.assembler.write1(popMap[key2]);
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
        let key2 = null;
        if (/^\$[\da-f]+$/i.test(left)) {
          key2 = `$,${right.toUpperCase()}`;
        } else if (/^\$[\da-f]+\+x$/i.test(left)) {
          key2 = `$+X,${right.toUpperCase()}`;
        } else if (/^\$[\da-f]+$/i.test(right)) {
          key2 = `${left.toUpperCase()},$`;
        } else if (/^\$[\da-f]+\+x$/i.test(right)) {
          key2 = `${left.toUpperCase()},$+X`;
        }
        if (key2 && hasOwn(memoryMoves, key2)) {
          const operandWithAddr = /\$([^+]+)/.exec(left) ? left : right;
          const match = /\$([^+]+)/.exec(operandWithAddr);
          if (!match) return false;
          const val = parseInt(match[1], 16);
          const mode3 = memoryMoves[key2];
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
var word, register3, immediate2, address2, operandsFor3, r15Target, controlsFor, buildInstruction3, buildFusedInstruction, matchFused, availableAt, truncated, prefixAlt, SuperFxDecoder;
var init_superfx_decoder = __esm({
  "packages/plugin-snes/src/architectures/superfx-decoder.ts"() {
    "use strict";
    init_superfx_spec();
    word = (bytes, offset) => (bytes[offset] ?? 0) | (bytes[offset + 1] ?? 0) << 8;
    register3 = (value) => ({ kind: "register", register: `R${value}` });
    immediate2 = (value, width2, signed2 = false) => ({
      kind: "immediate",
      value,
      width: width2,
      ...signed2 ? { signed: true } : {}
    });
    address2 = (value, width2) => ({
      kind: "address",
      value,
      width: width2
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
          return [register3(registerNumber), address2((bytes[operandOffset] ?? 0) << 1, 2)];
        case "ramShortRegister":
          return [address2((bytes[operandOffset] ?? 0) << 1, 2), register3(registerNumber)];
        case "registerRamAbsolute":
          return [register3(registerNumber), address2(word(bytes, operandOffset), 2)];
        case "ramAbsoluteRegister":
          return [address2(word(bytes, operandOffset), 2), register3(registerNumber)];
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
    init_src2();
    init_compatibility();
    init_instruction_catalog2();
    init_operand_classifiers();
    lowerSuperFxOperand = (resolver, operand) => {
      const lowered = resolver.lowerOperand(operand);
      return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
    };
    hasOwn2 = (obj, key2) => Object.hasOwn(obj, key2);
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
    let address3 = 0;
    try {
      address3 = session.symbolScope.getLabelValue(label, false) & 16777215;
    } catch {
      address3 = 0;
    }
    session.write3(address3);
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
      normalizeForWrite(address3) {
        return address3 | 0;
      },
      advance(address3, amount, context) {
        const prefix = address3 & 4278190080;
        const logicalAddress = address3 & 16777215;
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
      toOutputOffset(address3, context) {
        if (address3 < 0 || address3 > 16777215) return -1;
        if (context.mapper === "lorom") {
          if ((address3 & 16646144) === 8257536 || (address3 & 4227072) === 0 || (address3 & 7372800) === 7340032) {
            return -1;
          }
          return (address3 & 8323072) >> 1 | address3 & 32767;
        }
        if (context.mapper === "hirom") {
          if ((address3 & 16646144) === 8257536 || (address3 & 4227072) === 0) {
            return -1;
          }
          return address3 & 4194303;
        }
        if (context.mapper === "exlorom") {
          if ((address3 & 15728640) === 7340032 || (address3 & 4227072) === 0) {
            return -1;
          }
          const mapped = (address3 & 8323072) >> 1 | address3 & 32767;
          return address3 & 8388608 ? mapped : mapped + 4194304;
        }
        if (context.mapper === "exhirom") {
          if ((address3 & 16646144) === 8257536 || (address3 & 4227072) === 0) {
            return -1;
          }
          return (address3 & 8388608) === 0 ? address3 & 4194303 | 4194304 : address3 & 4194303;
        }
        if (context.mapper === "sfxrom") {
          if ((address3 & 6291456) === 6291456 || (address3 & 4227072) === 0 || (address3 & 8388608) === 8388608) {
            return -1;
          }
          return address3 & 4194304 ? address3 & 4194303 : (address3 & 8323072) >> 1 | address3 & 32767;
        }
        if (context.mapper === "sa1rom") {
          if ((address3 & 4227072) === 32768) {
            return context.sa1banks[(address3 & 14680064) >> 21] | (address3 & 2031616) >> 1 | address3 & 32767;
          }
          if ((address3 & 12582912) === 12582912) {
            return context.sa1banks[(address3 & 1048576) >> 20 | (address3 & 2097152) >> 19] | address3 & 1048575;
          }
          return -1;
        }
        if (context.mapper === "bigsa1rom") {
          if ((address3 & 12582912) === 12582912) {
            return address3 & 4194303 | 4194304;
          }
          if ((address3 & 12582912) === 0 || (address3 & 12582912) === 8388608) {
            if ((address3 & 32768) === 0) return -1;
            return (address3 & 8388608) >> 2 | (address3 & 4128768) >> 1 | address3 & 32767;
          }
          return -1;
        }
        return context.mapper === "norom" ? address3 : -1;
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
        let address3 = offset;
        if (context.mapper === "lorom") {
          if (address3 >= 4194304) return -1;
          address3 = address3 << 1 & 8323072 | address3 & 32767 | 32768;
          return address3 | 8388608;
        }
        if (context.mapper === "hirom") {
          return address3 >= 4194304 ? -1 : address3 | 12582912;
        }
        if (context.mapper === "exlorom") {
          if (address3 >= 8388608) return -1;
          if (address3 & 4194304) {
            address3 -= 4194304;
            return address3 << 1 & 8323072 | address3 & 32767 | 32768;
          }
          address3 = address3 << 1 & 8323072 | address3 & 32767 | 32768;
          return address3 | 8388608;
        }
        if (context.mapper === "exhirom") {
          if (address3 >= 8388608) return -1;
          return address3 & 4194304 ? address3 : address3 | 12582912;
        }
        if (context.mapper === "sa1rom") {
          if (address3 >= 8388608) return -1;
          for (let index = 0; index < 8; index++) {
            if (context.sa1banks[index] === (address3 & 7340032)) {
              return 32768 | index << 21 | (address3 & 1015808) << 1 | address3 & 32767;
            }
          }
          return -1;
        }
        if (context.mapper === "bigsa1rom") {
          if (address3 >= 8388608) return -1;
          if ((address3 & 4194304) === 4194304) return address3 | 12582912;
          if ((address3 & 6291456) === 0) {
            return address3 << 1 & 4128768 | 32768 | address3 & 32767;
          }
          return 8388608 | address3 << 1 & 4128768 | 32768 | address3 & 32767;
        }
        if (context.mapper === "sfxrom") {
          return address3 >= 2097152 ? -1 : address3 << 1 & 8323072 | address3 & 32767 | 32768;
        }
        return context.mapper === "norom" ? address3 : -1;
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
var SNES_FILE_ADDRESS_SPACE, SNES_CPU_ADDRESS_SPACE, SNES_WRAM_ADDRESS_SPACE, SNES_SRAM_ADDRESS_SPACE, SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR, SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR, createSnesAddressContext;
var init_address_identities = __esm({
  "packages/plugin-snes/src/disassembler/address-identities.ts"() {
    "use strict";
    SNES_FILE_ADDRESS_SPACE = "rom.file";
    SNES_CPU_ADDRESS_SPACE = "snes.cpu";
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
    createSnesAddressContext = (mapper, sa1banks = [
      0,
      1048576,
      2097152,
      3145728,
      4194304,
      5242880,
      6291456,
      7340032
    ]) => ({ mapper, sa1banks });
  }
});

// packages/plugin-snes/src/disassembler/hardware-registers.ts
var FIXED_REGISTER_DEFINITIONS, FIXED_REGISTER_ALIASES, FIXED_REGISTERS, DMA_REGISTER_DEFINITIONS, DMA_REGISTERS_BY_OFFSET, identifySnesHardwareRegister, snesHardwareRegisterSymbols, hex2, snesHardwareDefineRecords, CONTROLLER_MASKS, INTERRUPT_STATUS_MASKS, renderConstants, renderSnesHardwareDefines;
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
    FIXED_REGISTER_ALIASES = [
      {
        symbol: "OBSEL",
        address: 8449,
        description: "Legacy alias for OBJSEL object size and character-data base addresses."
      },
      {
        symbol: "M7HOFS",
        address: 8461,
        description: "Mode 7 horizontal scroll, write twice; shares BG1HOFS."
      },
      {
        symbol: "M7VOFS",
        address: 8462,
        description: "Mode 7 vertical scroll, write twice; shares BG1VOFS."
      },
      {
        symbol: "JOYOUT",
        address: 16406,
        description: "Joypad latch output; write view of the address shared with JOYSER0."
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
    identifySnesHardwareRegister = (address3) => {
      const bank = address3 >>> 16 & 255;
      if (!(bank <= 63 || bank >= 128 && bank <= 191)) return void 0;
      const low = address3 & 65535;
      const fixed = FIXED_REGISTERS[low];
      if (fixed)
        return {
          address: address3,
          symbol: fixed.symbol,
          description: fixed.description,
          volatile: true
        };
      if (low >= 17152 && low <= 17279) {
        const channel = low - 17152 >>> 4;
        const register4 = low - 17152 & 15;
        const definition = DMA_REGISTERS_BY_OFFSET.get(register4);
        if (definition)
          return {
            address: address3,
            symbol: definition.symbol(channel),
            description: `DMA/HDMA channel ${channel}: ${definition.description}`,
            volatile: true
          };
      }
      return void 0;
    };
    snesHardwareRegisterSymbols = Object.freeze(
      Object.fromEntries(FIXED_REGISTER_DEFINITIONS.map(({ address: address3, symbol }) => [address3, symbol]))
    );
    hex2 = (value, width2) => `$${value.toString(16).toUpperCase().padStart(width2, "0")}`;
    snesHardwareDefineRecords = () => {
      const values = [...FIXED_REGISTER_DEFINITIONS, ...FIXED_REGISTER_ALIASES];
      for (let channel = 0; channel < 8; channel++) {
        for (const definition of DMA_REGISTER_DEFINITIONS) {
          const symbol = definition.symbol(channel);
          values.push({
            symbol,
            address: 17152 + channel * 16 + definition.offset,
            description: `DMA/HDMA channel ${channel}: ${definition.description}`
          });
          if (definition.legacySymbol) {
            values.push({
              symbol: definition.legacySymbol(channel),
              address: 17152 + channel * 16 + definition.offset,
              description: `Legacy alias for ${symbol}. DMA/HDMA channel ${channel}: ${definition.description}`
            });
          }
        }
      }
      return values.sort(
        (left, right) => left.address - right.address || left.symbol.localeCompare(right.symbol)
      );
    };
    CONTROLLER_MASKS = [
      { symbol: "JOY_B", value: 32768, description: "Controller B-button bit." },
      { symbol: "JOY_Y", value: 16384, description: "Controller Y-button bit." },
      { symbol: "JOY_SELECT", value: 8192, description: "Controller Select-button bit." },
      { symbol: "JOY_START", value: 4096, description: "Controller Start-button bit." },
      { symbol: "JOY_UP", value: 2048, description: "Controller D-pad Up bit." },
      { symbol: "JOY_DOWN", value: 1024, description: "Controller D-pad Down bit." },
      { symbol: "JOY_LEFT", value: 512, description: "Controller D-pad Left bit." },
      { symbol: "JOY_RIGHT", value: 256, description: "Controller D-pad Right bit." },
      { symbol: "JOY_A", value: 128, description: "Controller A-button bit." },
      { symbol: "JOY_X", value: 64, description: "Controller X-button bit." },
      { symbol: "JOY_L", value: 32, description: "Controller left-shoulder-button bit." },
      { symbol: "JOY_R", value: 16, description: "Controller right-shoulder-button bit." }
    ];
    INTERRUPT_STATUS_MASKS = [
      { symbol: "NMITIMEN_NMI", value: 128, description: "Enable V-blank NMI." },
      { symbol: "NMITIMEN_VIRQ", value: 32, description: "Enable vertical timer IRQ." },
      { symbol: "NMITIMEN_HIRQ", value: 16, description: "Enable horizontal timer IRQ." },
      { symbol: "NMITIMEN_AUTO_JOYPAD", value: 1, description: "Enable automatic joypad reads." },
      { symbol: "HVBJOY_VBLANK", value: 128, description: "V-blank status bit." },
      { symbol: "HVBJOY_HBLANK", value: 64, description: "H-blank status bit." },
      {
        symbol: "HVBJOY_AUTO_JOYPAD_BUSY",
        value: 1,
        description: "Automatic joypad read is in progress."
      }
    ];
    renderConstants = (constants, width2) => constants.map(
      ({ symbol, value, description }) => `${symbol} = ${hex2(value, width2)} ; ${description}`
    );
    renderSnesHardwareDefines = () => {
      const lines = [
        "; Built-in SNES hardware vocabulary generated by Uttori ASM.",
        "; Width state in generated banks is expressed with .a8/.a16 and .i8/.i16 directives.",
        "",
        "; PPU, APU, WRAM, controller, and CPU registers.",
        ...snesHardwareDefineRecords().map(
          ({ symbol, address: address3, description }) => `${symbol} = ${hex2(address3, 4)} ; ${description}`
        ),
        "",
        "; Common controller masks (16-bit auto-joypad result).",
        ...renderConstants(CONTROLLER_MASKS, 4),
        "",
        "; Common interrupt/status masks.",
        ...renderConstants(INTERRUPT_STATUS_MASKS, 2),
        "",
        "; MDMAEN/HDMAEN channel masks.",
        ...Array.from(
          { length: 8 },
          (_, channel) => `DMA_CHANNEL_${channel} = ${hex2(1 << channel, 2)} ; Select DMA/HDMA channel ${channel}.`
        ),
        ""
      ];
      return `${lines.join("\n")}
`;
    };
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
var fs6, import_node_path6, SNES_RAM_MAP_FORMAT, SNES_RAM_MAP_SCHEMA_VERSION, SNES_RAM_MAP_SOURCE, SNES_RAM_MAP_SCHEMA_SOURCE, hex3, cleanText, parseAddress, validateSnesRamMap, emptySnesRamMap, loadSnesRamMap;
var init_ram_map = __esm({
  "packages/plugin-snes/src/disassembler/ram-map.ts"() {
    "use strict";
    fs6 = __toESM(require("node:fs"), 1);
    import_node_path6 = __toESM(require("node:path"), 1);
    init_src();
    SNES_RAM_MAP_FORMAT = "uttori-asm-snes-ram-map";
    SNES_RAM_MAP_SCHEMA_VERSION = 1;
    SNES_RAM_MAP_SOURCE = "ram-map.json";
    SNES_RAM_MAP_SCHEMA_SOURCE = "ram-map.schema.json";
    hex3 = (value, width2 = 6) => `$${value.toString(16).toUpperCase().padStart(width2, "0")}`;
    cleanText = (value, field) => {
      const cleaned = value.replaceAll(/\s+/g, " ").trim();
      if (!cleaned) throw new Error(`RAM-map ${field} must not be empty.`);
      return cleaned;
    };
    parseAddress = (value) => {
      let address3;
      if (typeof value === "number") address3 = value;
      else {
        const text = value.trim();
        if (/^\$[\dA-Fa-f]{1,6}$/.test(text)) address3 = Number.parseInt(text.slice(1), 16);
        else if (/^0x[\da-f]{1,6}$/i.test(text)) address3 = Number.parseInt(text.slice(2), 16);
        else throw new Error(`Invalid RAM-map address '${value}'.`);
      }
      if (!Number.isSafeInteger(address3) || address3 < 8257536 || address3 > 8388607) {
        throw new Error(`RAM-map address '${String(value)}' is outside canonical SNES WRAM.`);
      }
      return address3;
    };
    validateSnesRamMap = (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("RAM map must be a JSON object.");
      const file = value;
      if (file.format !== SNES_RAM_MAP_FORMAT) throw new Error("Invalid SNES RAM-map format.");
      if (file.schemaVersion !== SNES_RAM_MAP_SCHEMA_VERSION)
        throw new Error(`Unsupported SNES RAM-map schema ${String(file.schemaVersion)}.`);
      if (!Array.isArray(file.variables)) throw new Error("RAM map must contain a variables array.");
      const names = /* @__PURE__ */ new Set();
      const addresses2 = /* @__PURE__ */ new Set();
      const variables = file.variables.map((input, index) => {
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new Error(`RAM-map variable ${index + 1} must be an object.`);
        const record = input;
        if (typeof record.name !== "string")
          throw new Error(`RAM-map variable ${index + 1} name must be a string.`);
        const name = cleanText(record.name, `variable ${index + 1} name`);
        if (!/^[A-Z_a-z]\w*$/.test(name))
          throw new Error(`RAM-map variable name '${name}' is not an assembler identifier.`);
        const nameKey = name.toLowerCase();
        if (names.has(nameKey)) throw new Error(`Duplicate RAM-map variable name '${name}'.`);
        names.add(nameKey);
        if (typeof record.address !== "string" && typeof record.address !== "number")
          throw new Error(`RAM-map variable '${name}' must have a string or integer address.`);
        const address3 = parseAddress(record.address);
        if (addresses2.has(address3))
          throw new Error(`Duplicate RAM-map address '${hex3(address3)}'; combine aliases in one entry.`);
        addresses2.add(address3);
        const size = record.size ?? 1;
        if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || address3 + size > 8388608)
          throw new Error(`Invalid size for RAM-map variable '${name}'.`);
        if (record.category !== void 0 && typeof record.category !== "string")
          throw new Error(`RAM-map category for '${name}' must be a string.`);
        const category = record.category === void 0 ? void 0 : cleanText(record.category, `${name} category`);
        if (typeof record.description !== "string")
          throw new Error(`RAM-map description for '${name}' must be a string.`);
        const description = cleanText(record.description, `${name} description`);
        if (record.notes !== void 0 && !Array.isArray(record.notes))
          throw new Error(`RAM-map notes for '${name}' must be an array.`);
        const notes = (record.notes ?? []).map((note) => {
          if (typeof note !== "string") throw new Error(`RAM-map notes for '${name}' must be strings.`);
          return cleanText(note, `${name} note`);
        });
        return { name, address: address3, size, ...category ? { category } : {}, description, notes };
      });
      const sorted2 = variables.sort(
        (left, right) => left.address - right.address || left.name.localeCompare(right.name)
      );
      for (let index = 1; index < sorted2.length; index++) {
        const previous = sorted2[index - 1];
        const current2 = sorted2[index];
        if (current2.address < previous.address + previous.size) {
          throw new Error(
            `RAM-map variables '${previous.name}' and '${current2.name}' overlap at ${hex3(current2.address)}.`
          );
        }
      }
      return sorted2;
    };
    emptySnesRamMap = () => ({
      $schema: `./${SNES_RAM_MAP_SCHEMA_SOURCE}`,
      format: SNES_RAM_MAP_FORMAT,
      schemaVersion: SNES_RAM_MAP_SCHEMA_VERSION,
      variables: []
    });
    loadSnesRamMap = (directory) => {
      const file = import_node_path6.default.join(directory, SNES_RAM_MAP_SOURCE);
      if (!fs6.existsSync(file)) {
        fs6.mkdirSync(directory, { recursive: true });
        fs6.writeFileSync(file, canonicalSourceExportJson(emptySnesRamMap()));
      }
      const sourceBytes = fs6.readFileSync(file);
      let parsed;
      try {
        parsed = JSON.parse(sourceBytes.toString("utf8"));
      } catch (error) {
        throw new Error(
          `Could not parse '${SNES_RAM_MAP_SOURCE}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
      const variables = validateSnesRamMap(parsed);
      return { file: parsed, variables, sourceBytes };
    };
  }
});

// packages/plugin-snes/src/disassembler/source-export.ts
var toFileOffset, snesSourceLabelNames;
var init_source_export2 = __esm({
  "packages/plugin-snes/src/disassembler/source-export.ts"() {
    "use strict";
    init_src();
    init_address_space();
    init_address_identities();
    init_hardware_registers();
    toFileOffset = (addressSpace, address3, mapper, romSize) => {
      if (addressSpace === SNES_FILE_ADDRESS_SPACE) return address3 < romSize ? address3 : void 0;
      if (addressSpace !== SNES_CPU_ADDRESS_SPACE) return void 0;
      const offset = snesRomAddressSpace.toOutputOffset(address3, createSnesAddressContext(mapper));
      return offset >= 0 && offset < romSize ? offset : void 0;
    };
    snesSourceLabelNames = (shards, mapper, romSize, ramNames = []) => {
      const offsets = new Set(
        shards.labels.map((label) => toFileOffset(label.addressSpace, label.address, mapper, romSize))
      );
      const reserved = [...renderSnesHardwareDefines().matchAll(/^([A-Z_a-z]\w*)\s*=/gm)].map(
        (match) => match[1]
      );
      for (const name of ramNames) reserved.push(name);
      for (const fn of shards.analysis) {
        if (fn.kind !== "function") continue;
        const offset = toFileOffset(fn.addressSpace, fn.address, mapper, romSize);
        if (offset !== void 0 && !offsets.has(offset))
          reserved.push(`Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`);
      }
      for (const label of shards.labels) {
        if (label.sourceName && /^snes_/i.test(label.sourceName))
          throw new Error(`Source label '${label.sourceName}' uses the reserved SNES_ namespace.`);
      }
      return projectSourceLabelNames(shards.labels, reserved);
    };
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

// packages/plugin-snes/src/disassembler/function-heuristics.ts
var import_node_crypto5, isArray2, rank, writes, reads, builtins, SNES_HEURISTIC_RULE_IDS, validateSnesHeuristicConfiguration, width, addresses, immediate3, analyzeSnesFunctionRoles;
var init_function_heuristics = __esm({
  "packages/plugin-snes/src/disassembler/function-heuristics.ts"() {
    "use strict";
    import_node_crypto5 = require("node:crypto");
    init_src();
    init_hardware_registers();
    isArray2 = (value) => Array.isArray(value);
    rank = { low: 0, medium: 1, high: 2 };
    writes = /* @__PURE__ */ new Set(["STA", "STX", "STY", "STZ"]);
    reads = /* @__PURE__ */ new Set([
      "LDA",
      "LDX",
      "LDY",
      "CMP",
      "CPX",
      "CPY",
      "BIT",
      "AND",
      "ORA",
      "EOR",
      "ADC",
      "SBC"
    ]);
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
    validateSnesHeuristicConfiguration = (value) => {
      if (!value || typeof value !== "object" || isArray2(value))
        throw new Error("SNES heuristics must be an object.");
      const config = value;
      const allowed = /* @__PURE__ */ new Set([
        "enabled",
        "minimumConfidence",
        "maxWindowInstructions",
        "disabledRules",
        "registerRules"
      ]);
      for (const key2 of Object.keys(config))
        if (!allowed.has(key2)) throw new Error(`Unknown SNES heuristic option '${key2}'.`);
      if (config.enabled !== void 0 && typeof config.enabled !== "boolean")
        throw new Error("Heuristic enabled must be boolean.");
      if (config.minimumConfidence !== void 0 && !Object.hasOwn(rank, config.minimumConfidence))
        throw new Error("Invalid heuristic confidence.");
      if (config.maxWindowInstructions !== void 0 && (!Number.isInteger(config.maxWindowInstructions) || config.maxWindowInstructions < 2 || config.maxWindowInstructions > 256))
        throw new Error("Heuristic window must be between 2 and 256 instructions.");
      if (config.registerRules !== void 0 && (!isArray2(config.registerRules) || config.registerRules.length > 128))
        throw new Error("At most 128 register rules are allowed.");
      const ids = new Set(SNES_HEURISTIC_RULE_IDS);
      for (const rule of config.registerRules ?? []) {
        if (!rule || typeof rule.id !== "string" || !/^[a-z][\d.a-z-]*$/.test(rule.id) || ids.has(rule.id) || typeof rule.role !== "string" || !/^[a-z][\d.a-z-]*$/.test(rule.role) || !["read", "write"].includes(rule.access) || !Object.hasOwn(rank, rule.confidence) || !isArray2(rule.addresses) || !rule.addresses.length || rule.addresses.length > 256 || rule.addresses.some(
          (address3) => !Number.isInteger(address3) || !identifySnesHardwareRegister(address3)
        ))
          throw new Error("Invalid or duplicate SNES register role rule.");
        ids.add(rule.id);
      }
      if (config.disabledRules !== void 0 && (!isArray2(config.disabledRules) || config.disabledRules.some((id) => !ids.has(id))))
        throw new Error("Unknown disabled heuristic rule.");
      return config;
    };
    width = (node, register4 = "a") => {
      const flag = node.incomingState[register4 === "a" ? "m" : "x"];
      if (flag?.kind !== "known") return void 0;
      if (flag.value === 1) return 1;
      return flag.value === 0 ? 2 : void 0;
    };
    addresses = (node) => node.effectiveAddresses.flatMap((effect) => {
      if (typeof effect.address !== "number") return [];
      const hardware = identifySnesHardwareRegister(effect.address);
      return hardware ? [hardware.address] : [];
    });
    immediate3 = (node) => node.mode.startsWith("immediate") && node.bytes?.length ? node.bytes.slice(1).reduce((sum, byte, index) => sum + byte * 2 ** (8 * index), 0) : void 0;
    analyzeSnesFunctionRoles = (shards, options = {}, runtime = shards.runtime) => {
      const config = validateSnesHeuristicConfiguration(options);
      if (config.enabled === false) return { roles: [], comments: [], evidence: [] };
      const disabled = new Set(config.disabledRules);
      const limit = config.maxWindowInstructions ?? 48;
      const nodes = new Map(
        shards.analysis.filter(
          (record) => record.kind === "cfg-node" && record.addressSpace === "snes.cpu" && record.specificationId.startsWith("snes.65816.")
        ).map((node) => [node.id, node])
      );
      const edges = shards.analysis.filter(
        (record) => record.kind === "cfg-edge" && record.addressSpace === "snes.cpu"
      );
      const incoming = /* @__PURE__ */ new Map();
      for (const edge of edges)
        if (edge.to) {
          const list = incoming.get(edge.to) ?? [];
          list.push(edge);
          incoming.set(edge.to, list);
        }
      const window = (end) => {
        const result = [end];
        const seen = /* @__PURE__ */ new Set([end.id]);
        while (result.length < limit) {
          const links = (incoming.get(result[0].id) ?? []).filter((edge) => edge.edgeKind !== "call");
          if (links.length !== 1 || links[0].edgeKind !== "fallthrough") break;
          const previous = nodes.get(links[0].from);
          if (!previous || seen.has(previous.id)) break;
          seen.add(previous.id);
          result.unshift(previous);
        }
        return result;
      };
      const found = /* @__PURE__ */ new Map();
      const emit = (node, rule, role, confidence, evidenceNodes, explanation, relationship = "direct") => {
        if (disabled.has(rule) || rank[confidence] < rank[config.minimumConfidence ?? "medium"]) return;
        const key2 = `${node.addressSpace}:${node.address}:${rule}:${role}:${relationship}`;
        const prior = found.get(key2);
        found.set(key2, {
          id: `heuristic:snes:${(0, import_node_crypto5.createHash)("sha256").update(key2).digest("hex").slice(0, 24)}`,
          rule,
          role,
          addressSpace: node.addressSpace,
          address: node.address,
          confidence,
          relationship,
          instructions: [
            .../* @__PURE__ */ new Set([
              ...prior?.instructions ?? [],
              ...evidenceNodes.map((entry) => entry.address)
            ])
          ].sort((a, b) => a - b),
          explanation,
          evidence: [
            .../* @__PURE__ */ new Set([
              ...prior?.evidence ?? [],
              ...evidenceNodes.flatMap((entry) => entry.evidence)
            ])
          ].sort()
        });
      };
      for (const node of nodes.values()) {
        const ports = addresses(node);
        for (const rule of [...builtins, ...config.registerRules ?? []])
          if ((rule.access === "write" ? writes : reads).has(node.mnemonic) && ports.some(
            (address3) => rule.addresses.some(
              (candidate) => identifySnesHardwareRegister(candidate)?.address === address3
            )
          ))
            emit(
              node,
              rule.id,
              rule.role,
              rule.confidence,
              [node],
              `Resolved ${rule.access} of ${ports.map((address3) => `$${address3.toString(16)}`).join(", ")}.`
            );
        if (["MVN", "MVP"].includes(node.mnemonic))
          emit(
            node,
            "block-copy",
            "memory.block-copy",
            "high",
            [node],
            "Block move instruction; payload purpose requires destination provenance."
          );
        const trail = window(node);
        if (node.mnemonic === "STA" && ports.includes(16907)) {
          const values = /* @__PURE__ */ new Map();
          const registers2 = /* @__PURE__ */ new Map();
          for (const step of trail) {
            const imm = immediate3(step);
            if (["LDA", "LDX", "LDY"].includes(step.mnemonic)) {
              if (imm === void 0) registers2.delete(step.mnemonic[2]);
              else registers2.set(step.mnemonic[2], { value: imm, size: step.bytes.length - 1 });
            } else if (writes.has(step.mnemonic)) {
              let register4 = "a";
              if (step.mnemonic === "STX") register4 = "x";
              if (step.mnemonic === "STY") register4 = "y";
              const size = width(step, register4);
              const source = registers2.get(step.mnemonic[2]);
              let value;
              if (source && size !== void 0 && source.size >= size) value = source.value;
              if (step.mnemonic === "STZ") value = 0;
              if (!step.effectiveAddresses.length || step.effectiveAddresses.some((effect) => effect.address === void 0))
                values.clear();
              for (const port of addresses(step))
                for (let i = 0; i < (size ?? 2); i++) {
                  if (value === void 0 || size === void 0) values.delete(port + i);
                  else values.set(port + i, value >> 8 * i & 255);
                }
            } else if (!["REP", "SEP", "NOP"].includes(step.mnemonic)) {
              registers2.clear();
              if (["JSR", "JSL", "JMP", "JML", "MVN", "MVP"].includes(step.mnemonic)) values.clear();
            }
          }
          const mask = values.get(16907);
          if (mask !== void 0) {
            for (let channel = 0; channel < 8; channel++)
              if (mask & 1 << channel) {
                const mode3 = values.get(17152 + channel * 16);
                const target = values.get(17153 + channel * 16);
                if (mode3 === void 0 || target === void 0 || mode3 & 128) continue;
                let role;
                if (target === 24 && (mode3 & 7) === 1) role = "graphics.vram-dma";
                if (target === 34 && (mode3 & 7) === 0) role = "graphics.palette-dma";
                if (target === 4 && (mode3 & 7) === 0) role = "graphics.oam-dma";
                if (role)
                  emit(
                    node,
                    "dma-destination",
                    role,
                    "high",
                    trail,
                    `Channel ${channel} starts A-to-B DMA, mode ${mode3 & 7}, B-bus target $21${target.toString(16).padStart(2, "0")}. Source/length may remain unresolved.`
                  );
              }
          }
        }
        if (node.mnemonic === "STA" && ports.includes(8453) && trail.some((step) => immediate3(step) === 7) && trail.filter(
          (step) => writes.has(step.mnemonic) && addresses(step).some((address3) => address3 >= 8475 && address3 <= 8480)
        ).length >= 4)
          emit(
            node,
            "mode7-setup",
            "graphics.mode7-setup",
            "medium",
            trail,
            "Matrix/center writes and a nearby mode-7 constant; confirm the value reaching BGMODE."
          );
      }
      for (const edge of edges) {
        if (edge.edgeKind !== "branch" || edge.toAddress === void 0 || edge.toAddress > edge.fromAddress)
          continue;
        const end = nodes.get(edge.from);
        if (!end) continue;
        const trail = window(end);
        const startIndex = trail.findIndex((node) => node.address === edge.toAddress);
        if (startIndex < 0) continue;
        const loop = trail.slice(startIndex);
        const start = loop[0];
        const has = (set, port) => loop.some((node) => set.has(node.mnemonic) && addresses(node).includes(port));
        if (["BNE", "BEQ"].includes(end.mnemonic) && loop.slice(-3, -1).some(
          (node) => ["CMP", "CPX", "CPY", "LDA"].includes(node.mnemonic) && addresses(node).includes(8512)
        )) {
          emit(
            start,
            "apu-handshake",
            "audio.handshake-wait",
            "high",
            loop,
            "Backward conditional loop polls the resolved APU acknowledgement port."
          );
        }
        if (has(reads, 16914) && loop.some((node) => ["AND", "BIT"].includes(node.mnemonic) && immediate3(node) === 128))
          emit(
            start,
            "vblank-wait",
            "timing.vblank-wait",
            "high",
            loop,
            "Backward loop tests HVBJOY bit 7."
          );
        if (has(writes, 8448) && loop.some((node) => ["INC", "DEC"].includes(node.mnemonic)))
          emit(
            start,
            "display-fade",
            "graphics.brightness-ramp",
            "medium",
            loop,
            "Repeated brightness writes with an increment/decrement; frame synchronization needs caller/trace evidence."
          );
      }
      const contextNodes = /* @__PURE__ */ new Map();
      for (const node of nodes.values()) {
        const key2 = canonicalJson(node.context);
        const indexed = contextNodes.get(key2) ?? /* @__PURE__ */ new Map();
        const choices = indexed.get(node.address) ?? [];
        choices.push(node);
        indexed.set(node.address, choices);
        contextNodes.set(key2, indexed);
      }
      const handshakeAddresses = new Set(
        [...found.values()].filter((role) => role.rule === "apu-handshake").map((role) => role.address)
      );
      for (const edge of edges) {
        if (edge.edgeKind !== "branch" || edge.toAddress === void 0 || edge.toAddress >= edge.fromAddress)
          continue;
        const end = nodes.get(edge.from);
        const start = edge.to ? nodes.get(edge.to) : void 0;
        if (!end || !start) continue;
        const indexed = contextNodes.get(canonicalJson(start.context));
        const loop = [];
        let cursor = start.address;
        while (cursor <= end.address && loop.length < limit) {
          const choices = indexed.get(cursor);
          if (choices?.length !== 1) break;
          const node = choices[0];
          loop.push(node);
          cursor += node.size;
        }
        if (loop.length < 4 || loop.at(-1)?.id !== end.id) continue;
        const payload = loop.some((node) => node.mnemonic === "LDA" && node.mode.includes("Indirect"));
        const ports = new Set(loop.filter((node) => writes.has(node.mnemonic)).flatMap(addresses));
        const ack = loop.some(
          (node) => ["CMP", "CPX", "CPY"].includes(node.mnemonic) && addresses(node).includes(8512)
        );
        const handshake = loop.some((node) => handshakeAddresses.has(node.address));
        if (payload && ack && handshake && ports.has(8512) && [8513, 8514, 8515].some((port) => ports.has(port)) && loop.some((node) => ["INY", "INX", "DEX", "DEY"].includes(node.mnemonic)))
          emit(
            start,
            "apu-upload",
            "audio.bulk-upload",
            "high",
            loop,
            "Advancing indirect source feeds APU payload ports with a token/acknowledgement cycle inside a counted loop."
          );
      }
      const atAddress = /* @__PURE__ */ new Map();
      for (const node of nodes.values()) {
        const list = atAddress.get(node.address) ?? [];
        list.push(node);
        atAddress.set(node.address, list);
      }
      for (const access of runtime) {
        if (access.kind !== "runtime-memory-access" || access.architecture !== "snes.65816" || access.instructionAddressSpace !== "snes.cpu" || access.accessedAddressSpace !== "snes.cpu")
          continue;
        const port = identifySnesHardwareRegister(access.accessedAddress)?.address;
        if (port === void 0) continue;
        for (const node of atAddress.get(access.instructionAddress) ?? []) {
          const observedNode = { ...node, evidence: [...node.evidence, ...access.evidence] };
          if (access.actor === "dma" || access.actor === "hdma") {
            if (access.access !== "write") continue;
            let role;
            if ([8472, 8473].includes(port)) role = "graphics.vram-transfer";
            if (port === 8482) role = "graphics.palette-transfer";
            if (port === 8452) role = "graphics.oam-transfer";
            if (role)
              emit(
                node,
                "observed-access",
                role,
                "high",
                [observedNode],
                `Observed ${access.actor.toUpperCase()} channel ${access.channel ?? "unknown"} write to $${port.toString(16)} during this instruction; the DMA engine performs the bus operation.`
              );
          } else
            for (const rule of [...builtins, ...config.registerRules ?? []]) {
              if (!disabled.has(rule.id) && access.access === rule.access && rule.addresses.some(
                (address3) => identifySnesHardwareRegister(address3)?.address === port
              ))
                emit(
                  node,
                  "observed-access",
                  rule.role,
                  rule.confidence,
                  [observedNode],
                  `Observed CPU ${access.access} at $${port.toString(16)} resolves the executed operand, including indexed/indirect access.`
                );
            }
        }
      }
      const functionAddresses = new Set(
        shards.analysis.flatMap(
          (record) => record.kind === "function" && record.addressSpace === "snes.cpu" ? [record.address] : []
        )
      );
      for (const role of [...found.values()])
        for (const node of atAddress.get(role.address) ?? []) {
          const owner = [...node.evidencePath].reverse().map((id) => nodes.get(id)).find(
            (candidate) => candidate && functionAddresses.has(candidate.address) && canonicalJson(candidate.context) === canonicalJson(node.context)
          );
          if (owner && owner.address !== node.address)
            emit(
              owner,
              role.rule,
              role.role,
              role.confidence,
              [node, owner],
              `Function contains ${role.role} evidence at $${node.address.toString(16)}. ${role.explanation}`
            );
        }
      const directByAddress = /* @__PURE__ */ new Map();
      for (const role of found.values()) {
        const list = directByAddress.get(role.address) ?? [];
        list.push(role);
        directByAddress.set(role.address, list);
      }
      for (const edge of edges)
        if (edge.edgeKind === "call" && edge.toAddress !== void 0) {
          const caller = nodes.get(edge.from);
          if (!caller) continue;
          for (const role of directByAddress.get(edge.toAddress) ?? [])
            emit(
              caller,
              "wrapper",
              role.role,
              "medium",
              [{ ...caller, evidence: [...caller.evidence, ...role.evidence] }],
              `Calls $${edge.toAddress.toString(16)} with ${role.role} evidence. Caller may have other roles.`,
              "delegated"
            );
        }
      const roles = [...found.values()].sort(
        (a, b) => a.address - b.address || a.id.localeCompare(b.id)
      );
      const signature = (0, import_node_crypto5.createHash)("sha256").update(canonicalJson(config)).digest("hex").slice(0, 16);
      const evidence = roles.map((role) => ({
        id: `${role.id}:evidence`,
        source: "detector",
        sourceId: "snes.function-roles.v1",
        confidence: role.confidence,
        detail: `${role.rule}; configuration ${signature}; ${role.explanation}; instructions ${role.instructions.map((address3) => `$${address3.toString(16)}`).join(", ")}`
      }));
      return {
        roles,
        evidence,
        comments: roles.map((role) => ({
          id: role.id,
          addressSpace: role.addressSpace,
          address: role.address,
          text: `[${role.confidence} heuristic: ${role.role}${role.relationship === "delegated" ? " via call" : ""}] ${role.explanation}`,
          evidence: [...role.evidence, `${role.id}:evidence`]
        }))
      };
    };
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
var objectValue2, optionsFor2, integerOption2, stringOption2, readBytes, resolveCount, resolveGrid, decodedObject2, arrayValue, integerValue, defaultPath, jsonFile2;
var init_common2 = __esm({
  "packages/plugin-snes/src/assets/common.ts"() {
    "use strict";
    objectValue2 = (value, label) => {
      if (value === void 0) return {};
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        throw new Error(`${label} must be an object.`);
      }
      return value;
    };
    optionsFor2 = (context) => objectValue2(context.request.options, `Asset '${context.request.id}' options`);
    integerOption2 = (options, key2, bounds = {}) => {
      const value = options[key2] ?? bounds.fallback;
      if (value === void 0 || typeof value !== "number" || !Number.isSafeInteger(value) || bounds.minimum !== void 0 && value < bounds.minimum || bounds.maximum !== void 0 && value > bounds.maximum) {
        if (value === void 0) return void 0;
        throw new Error(`Asset option '${key2}' is outside its integer bounds.`);
      }
      return value;
    };
    stringOption2 = (options, key2, fallback) => {
      const value = options[key2] ?? fallback;
      if (typeof value !== "string" || value === "") {
        throw new Error(`Asset option '${key2}' must be a non-empty string.`);
      }
      return value;
    };
    readBytes = (source, offset, size, owner) => {
      const bytes = source.read(offset, size);
      if (!bytes) throw new Error(`SNES asset '${owner}' source range is unreadable.`);
      return bytes;
    };
    resolveCount = (context, unitSize, options = optionsFor2(context)) => {
      const configured = integerOption2(options, "count", { minimum: 1 });
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
      const options = optionsFor2(context);
      const width2 = integerOption2(options, "width", { minimum: 1 });
      const height = integerOption2(options, "height", { minimum: 1 });
      if (width2 === void 0 !== (height === void 0)) {
        throw new Error("SNES grid assets require both 'width' and 'height'.");
      }
      const configuredCount = width2 === void 0 ? void 0 : width2 * height;
      if (configuredCount !== void 0 && !Number.isSafeInteger(configuredCount)) {
        throw new Error(`SNES asset '${context.request.id}' grid dimensions overflowed.`);
      }
      const countOption = integerOption2(options, "count", { minimum: 1 });
      if (countOption !== void 0 && configuredCount !== void 0 && countOption !== configuredCount) {
        throw new Error("SNES grid dimensions do not match option 'count'.");
      }
      const resolved = resolveCount(context, unitSize, {
        ...options,
        ...configuredCount === void 0 ? {} : { count: configuredCount }
      });
      return {
        ...resolved,
        ...width2 === void 0 ? {} : { width: width2, height }
      };
    };
    decodedObject2 = (value, owner) => objectValue2(value, `Decoded SNES asset '${owner}'`);
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
    jsonFile2 = (path9, value) => ({
      path: path9,
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
    init_common2();
    SNES_BRR_ASSET_CODEC_ID = "snes.asset.brr";
    blockCountAndSize = (context) => {
      if (context.request.length !== void 0) {
        if (context.request.length % 9 !== 0) {
          throw new Error(`BRR asset '${context.request.id}' length must be a multiple of 9 bytes.`);
        }
        return { blockCount: context.request.length / 9, size: context.request.length };
      }
      const options = optionsFor2(context);
      const maxBlocks = integerOption2(options, "maxBlocks", { minimum: 1 });
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
        const options = optionsFor2(context);
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
        const path9 = stringOption2(options, "path", defaultPath(context.request.id, "brr"));
        const metadataPath = stringOption2(
          options,
          "metadataPath",
          defaultPath(context.request.id, "brr.json")
        );
        return {
          value,
          files: [{ path: path9, mediaType: "audio/x-snes-brr", bytes }, jsonFile2(metadataPath, value)]
        };
      },
      encode: (context) => {
        const resolved = blockCountAndSize(context);
        const value = decodedObject2(context.decoded.value, context.request.id);
        const blocks = arrayValue(value.blocks, `BRR asset '${context.request.id}' blocks`);
        if (blocks.length !== resolved.blockCount) {
          throw new Error(`BRR asset '${context.request.id}' requires ${resolved.blockCount} blocks.`);
        }
        const bytes = new Uint8Array(resolved.size);
        blocks.forEach((blockValue, blockIndex) => {
          const block = objectValue2(blockValue, `BRR block ${blockIndex}`);
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
    init_common2();
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
        const options = optionsFor2(context);
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
        const path9 = stringOption2(options, "path", defaultPath(context.request.id, "palette.json"));
        return { value, files: [jsonFile2(path9, value)] };
      },
      encode: (context) => {
        const { count, size } = resolveCount(context, 2);
        const value = decodedObject2(context.decoded.value, context.request.id);
        const colors = arrayValue(value.colors, `SNES palette '${context.request.id}' colors`);
        if (colors.length !== count) {
          throw new Error(`SNES palette '${context.request.id}' requires exactly ${count} colors.`);
        }
        const bytes = new Uint8Array(size);
        colors.forEach((colorValue, index) => {
          const color = objectValue2(colorValue, `SNES palette color ${index}`);
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
    init_common2();
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
        const options = optionsFor2(context);
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
        const path9 = stringOption2(options, "path", defaultPath(context.request.id, "tilemap.json"));
        return { value, files: [jsonFile2(path9, value)] };
      },
      encode: (context) => {
        const resolved = resolveGrid(context, 2);
        const value = decodedObject2(context.decoded.value, context.request.id);
        const entries3 = arrayValue(value.entries, `SNES tilemap '${context.request.id}' entries`);
        if (entries3.length !== resolved.count) {
          throw new Error(`SNES tilemap '${context.request.id}' requires ${resolved.count} entries.`);
        }
        const bytes = new Uint8Array(resolved.size);
        entries3.forEach((entryValue, index) => {
          const entry = objectValue2(entryValue, `SNES tilemap entry ${index}`);
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
        const options = optionsFor2(context);
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
        const path9 = stringOption2(
          options,
          "path",
          defaultPath(context.request.id, "mode7-tilemap.json")
        );
        return { value, files: [jsonFile2(path9, value)] };
      },
      encode: (context) => {
        const resolved = resolveGrid(context, 1);
        const value = decodedObject2(context.decoded.value, context.request.id);
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
    init_common2();
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
          const options = optionsFor2(context);
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
          const path9 = stringOption2(
            options,
            "path",
            defaultPath(context.request.id, `${bitsPerPixel}bpp.json`)
          );
          return { value, files: [jsonFile2(path9, value)] };
        },
        encode: (context) => {
          const { count, size } = resolveCount(context, bytesPerTile);
          const value = decodedObject2(context.decoded.value, context.request.id);
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
        const options = optionsFor2(context);
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
        const path9 = stringOption2(options, "path", defaultPath(context.request.id, "mode7.json"));
        return { value, files: [jsonFile2(path9, value)] };
      },
      encode: (context) => {
        const { count, size } = resolveCount(context, 64);
        const value = decodedObject2(context.decoded.value, context.request.id);
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
var SNES_SVG_ASSET_PREVIEW_ID, objectValue3, arrayValue2, numberValue, byteHex, svgFile, svg, renderTiles, renderPalette, indexColor, renderTilemap, renderBrr, snesSvgAssetPreviewRenderer;
var init_previews = __esm({
  "packages/plugin-snes/src/assets/previews.ts"() {
    "use strict";
    init_brr();
    init_palette();
    init_tilemap();
    init_tiles();
    SNES_SVG_ASSET_PREVIEW_ID = "snes.preview.svg";
    objectValue3 = (value, name) => {
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
    svg = (width2, height, content, total) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width2} ${height}" width="${width2}" height="${height}" shape-rendering="crispEdges" data-total="${total}"><rect width="100%" height="100%" fill="#101418"/>${content}</svg>
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
        const color = objectValue3(entry, `SNES preview color ${index}`);
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
          objectValue3(entry, `SNES preview tilemap entry ${index}`).tile,
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
          objectValue3(block, `SNES preview BRR block ${blockIndex}`).nibbles,
          "BRR nibbles"
        ).map((sample) => numberValue(sample, "BRR encoded nibble"))
      );
      const width2 = Math.max(1, samples.length * 2);
      const height = 64;
      const points = samples.map((sample, index) => `${index * 2},${32 - sample * 3}`).join(" ");
      const content = `<line x1="0" y1="32" x2="${width2}" y2="32" stroke="#56616b"/><polyline points="${points}" fill="none" stroke="#7ee787" stroke-width="1"/>`;
      return svgFile(id, svg(width2, height, content, allBlocks.length));
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
        const value = objectValue3(decoded.value, `SNES asset '${asset.id}' preview`);
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
var init_src3 = __esm({
  "packages/plugin-snes/src/index.ts"() {
    "use strict";
    init_src2();
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
    init_source_export2();
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
              normalizeForWrite: (address3) => snesRomAddressSpace.normalizeForWrite(address3, mappingContext()),
              advance: (address3, amount) => snesRomAddressSpace.advance(address3, amount, mappingContext()),
              toOutputOffset: (address3) => snesRomAddressSpace.toOutputOffset(address3, mappingContext()),
              fromOutputOffset: (offset) => snesRomAddressSpace.fromOutputOffset(offset, mappingContext()),
              validateWrite: (address3, width2) => {
                const targetState = state.get(snesSessionStateKey);
                const normalized = snesRomAddressSpace.normalizeForWrite(address3, mappingContext());
                if (snesRomAddressSpace.toOutputOffset(normalized, mappingContext()) < 0) return;
                if (targetState.bankCrossMode === "off" || width2 <= 1) return;
                const start = address3 & 16777215;
                const end = start + width2 - 1 & 16777215;
                const bankMask = targetState.bankCrossMode === "half" ? 2147450880 : 2147418112;
                if (((start ^ end) & bankMask) !== 0) {
                  const errorAddress = start + width2 & 16777215;
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
            beforeWrite: ({ session, logicalAddress, width: width2 }) => {
              const targetState = state.get(snesSessionStateKey);
              if (targetState.activeFreespaceStartOffset === null) return;
              const outputOffset = session.outputWriter.toOutputOffset(logicalAddress);
              if (outputOffset < 0) return;
              const endOffset = outputOffset + width2 - 1;
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

// packages/vscode-extension/src/analysis-worker.ts
var analysis_worker_exports = {};
module.exports = __toCommonJS(analysis_worker_exports);
var import_node_crypto7 = require("node:crypto");
var fs8 = __toESM(require("node:fs"));
var path8 = __toESM(require("node:path"));
var import_node_worker_threads = require("node:worker_threads");
init_src();
init_src3();

// packages/vscode-extension/src/analysis-annotation-format.ts
init_canonical_json();
var hexadecimal = (value) => `$${value.toString(16).toUpperCase().padStart(4, "0")}`;
var valueText = (value, present = true) => {
  if (!present) return "\u2205";
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value;
    if (record.kind === "known" && "value" in record) return valueText(record.value);
    if (record.kind === "unknown") return "?";
  }
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return Number.isInteger(value) ? hexadecimal(value) : String(value);
  if (typeof value === "boolean") return String(value);
  const serialized = JSON.stringify(canonicalValue(value)) ?? String(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}\u2026` : serialized;
};
var effectiveAddressText = (address3) => {
  const resolved = address3.address ?? address3.baseAddress;
  const identity = [address3.symbol, resolved === void 0 ? void 0 : hexadecimal(resolved)].filter((value) => value !== void 0).join("@");
  return `EA${address3.operandIndex} ${identity || "?"}${address3.address === void 0 && address3.baseAddress !== void 0 ? " base" : ""}${address3.volatile ? " volatile" : ""}`;
};
var transitionText = (transition) => `\u0394${transition.field} ${valueText(transition.before, "before" in transition)}\u2192${valueText(transition.after, "after" in transition)}`;
var stateText = (observation) => {
  const fields = Object.entries(observation.state).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => `${name}=${valueText(value)}`).join(",");
  return `${observation.source} state ${fields || "\u2205"}${observation.count === void 0 ? "" : ` \xD7${observation.count}`}`;
};
var accessText = (access) => {
  let mode3 = "?";
  if (access.access === "read") mode3 = "R";
  else if (access.access === "write") mode3 = "W";
  else if (access.access === "read-write") mode3 = "RW";
  return `${access.actor ? `${access.actor}${access.channel === void 0 ? "" : ` channel ${access.channel}`} ` : ""}${mode3} ${access.accessedAddressSpace}:${hexadecimal(access.accessedAddress)}${access.value === void 0 ? "" : `=${hexadecimal(access.value)}`} ${access.width}B \xD7${access.count}`;
};
var clipped = (value, maximum) => value.length <= maximum ? value : `${value.slice(0, maximum - 1)}\u2026`;
var formatInstructionAnnotationSummary = (annotation, maximumLength = 220) => {
  const parts = [];
  parts.push(...(annotation.comments ?? []).slice(0, 2).map(({ text }) => text));
  if (annotation.executionCount > 0) parts.push(`\u25B6 ${annotation.executionCount}\xD7`);
  const coverage = annotation.runtimeCoverage.map(({ coverage: coverage2 }) => coverage2);
  if (coverage.length > 0) parts.push(`coverage ${coverage.join("/")}`);
  parts.push(...annotation.effectiveAddresses.slice(0, 2).map(effectiveAddressText));
  parts.push(...annotation.memoryAccesses.slice(0, 2).map(accessText));
  parts.push(...annotation.stateTransitions.slice(0, 3).map(transitionText));
  if (annotation.stateTransitions.length === 0 && annotation.stateObservations.length > 0) {
    parts.push(stateText(annotation.stateObservations[0]));
  }
  return clipped(parts.join(" \xB7 "), Math.max(24, maximumLength));
};

// packages/vscode-extension/src/analysis-annotation-index.ts
var append = (map, key2, value) => {
  const entries3 = map.get(key2);
  if (entries3) entries3.push(value);
  else map.set(key2, [value]);
};
var lowerBound = (values, target, at) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (at(values[middle]) < target) low = middle + 1;
    else high = middle;
  }
  return low;
};
var valuesInRange = (values, start, end, at) => {
  const matches = [];
  for (let index = lowerBound(values, start, at); index < values.length && at(values[index]) < end; index++) {
    matches.push(values[index]);
  }
  return matches;
};
var createInstructionAnnotationIndex = (instructions) => {
  const byAddressSpace = /* @__PURE__ */ new Map();
  const byOutputOffset = [];
  for (const annotation of instructions) {
    append(byAddressSpace, annotation.addressSpace, annotation);
    for (const offset of annotation.outputOffsets) byOutputOffset.push({ offset, annotation });
  }
  for (const annotations of byAddressSpace.values()) {
    annotations.sort(
      (left, right) => left.address - right.address || left.id.localeCompare(right.id)
    );
  }
  byOutputOffset.sort(
    (left, right) => left.offset - right.offset || left.annotation.id.localeCompare(right.annotation.id)
  );
  return { byAddressSpace, byOutputOffset };
};
var instructionAnnotationsForDebugRange = (index, range) => {
  const matches = [
    ...valuesInRange(
      index.byAddressSpace.get(range.addressSpace) ?? [],
      range.start,
      range.end,
      ({ address: address3 }) => address3
    ),
    ...range.outputStart === void 0 || range.outputEnd === void 0 ? [] : valuesInRange(
      index.byOutputOffset,
      range.outputStart,
      range.outputEnd,
      ({ offset }) => offset
    ).map(({ annotation }) => annotation)
  ];
  const unique = new Map(
    matches.filter(
      (annotation) => annotation.architectures.length === 0 || annotation.architectures.includes(range.architecture)
    ).map((annotation) => [annotation.id, annotation])
  );
  return [...unique.values()].sort(
    (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
  );
};

// packages/vscode-extension/src/analysis-navigation-data.ts
init_src();
var projectAnalysisNavigation = (project, target, runtimeAt) => {
  if (project.manifest.target !== target.target || project.manifest.rom.contentSha256 !== target.romContentSha256 || project.manifest.rom.contentSize !== target.romContentSize)
    throw new Error("Navigation target no longer matches the current native analysis project.");
  const matchesArchitecture = (specification2) => !target.architectureHints.length || target.architectureHints.some(
    (architecture) => specification2 === architecture || specification2.startsWith(`${architecture}.`)
  );
  const nodes = project.shards.analysis.filter(
    (record) => record.kind === "cfg-node" && record.addressSpace === target.addressSpace && matchesArchitecture(record.specificationId)
  ).sort((a, b) => a.address - b.address || a.id.localeCompare(b.id));
  let index = nodes.findIndex(({ address: address3 }) => address3 >= target.address);
  if (index < 0) index = Math.max(0, nodes.length - 1);
  const visible = nodes.slice(Math.max(0, index - 4), Math.max(0, index - 4) + 32);
  const addresses2 = /* @__PURE__ */ new Set([...visible.map(({ address: address3 }) => address3), target.address]);
  const offsets = new Set(
    visible.flatMap((node) => node.fileOffset === void 0 ? [] : [node.fileOffset])
  );
  const fileSpaces = new Set(
    project.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
  );
  const locations = (space) => {
    if (space === target.addressSpace) return [...addresses2];
    return fileSpaces.has(space) ? [...offsets] : [];
  };
  function* runtimeCandidates() {
    if (!runtimeAt) {
      yield* project.shards.runtime;
      return;
    }
    for (const address3 of addresses2) yield* runtimeAt(target.addressSpace, address3);
    for (const space of fileSpaces) {
      if (space === target.addressSpace) continue;
      for (const offset of offsets) yield* runtimeAt(space, offset);
    }
  }
  const runtime = [...runtimeCandidates()].filter((record) => {
    if (!matchesArchitecture(record.architecture)) return false;
    if (record.kind === "runtime-memory-access")
      return record.instructionAddressSpace === target.addressSpace && addresses2.has(record.instructionAddress);
    if (record.kind === "runtime-control-target")
      return record.fromAddressSpace === target.addressSpace && addresses2.has(record.fromAddress);
    if (record.kind === "runtime-coverage")
      return locations(record.addressSpace).some(
        (address3) => record.start <= address3 && address3 < record.end
      );
    return record.addressSpace === target.addressSpace && addresses2.has(record.address);
  });
  const projection = buildInstructionAnalysisAnnotations(project.manifest, {
    ...project.shards,
    analysis: visible,
    runtime,
    annotations: project.shards.annotations.filter(
      (record) => locations(record.addressSpace).some(
        (address3) => record.start <= address3 && address3 < record.end
      )
    )
  });
  const summaries3 = new Map(
    projection.instructions.filter((record) => record.addressSpace === target.addressSpace).map((record) => [record.address, formatInstructionAnnotationSummary(record)])
  );
  const lines = visible.map((node) => {
    const bytes = (node.bytes ? node.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")) : [
      node.opcode.toString(16).toUpperCase().padStart(2, "0"),
      ...Array.from({ length: Math.max(0, node.size - 1) }, () => "??")
    ]).join(" ");
    const summary = summaries3.get(node.address);
    const context = node.context.length ? ` context=${node.context.map((value) => `0x${value.toString(16)}`).join("/")}` : "";
    return `${node.addressSpace}|0x${node.address.toString(16)}  ${bytes.padEnd(16)}  ${node.mnemonic} <${node.mode}> ; ${node.id}${context}${summary ? ` ; ${summary}` : ""}`;
  });
  const captured = runtime.filter(
    (record) => record.kind === "runtime-instruction" && record.address === target.address
  ).slice(0, 32);
  if (captured.length)
    lines.push(
      "; Saved execution-time instruction variants at the selected address:",
      ...captured.map(
        (record) => `${record.addressSpace}|0x${record.address.toString(16)}  ${record.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")} ; ${record.architecture} \xB7 recorded ${record.count} time(s)`
      )
    );
  return {
    lines,
    capturedRam: visible.some(
      (node) => node.address === target.address && node.fileOffset === void 0 && !!node.bytes
    ) || captured.length > 0 && !visible.some((node) => node.address === target.address && node.fileOffset !== void 0)
  };
};

// packages/vscode-extension/src/analysis-sources-data.ts
init_src();
var object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var strings = (value) => Array.isArray(value) && value.every((entry) => typeof entry === "string");
var hash = (value) => typeof value === "string" && /^[\da-f]{64}$/u.test(value);
var readAnalysisSourceCatalog = (directory) => {
  const store = openAnalysisProjectStore(directory);
  try {
    return store.transaction(() => {
      const manifest = store.manifest();
      const read = (kind) => {
        const records = store.loadTable(kind);
        for (const record of records) {
          if (!object(record) || typeof record.id !== "string")
            throw new Error(`Invalid source ${kind} identity.`);
          if (kind === "imports" && (typeof record.sourceName !== "string" || !hash(record.sourceSha256) || typeof record.format !== "string" || !strings(record.warnings) || !object(record.imported) || Object.values(record.imported).some(
            (value) => !Number.isSafeInteger(value) || value < 0
          ) || !Array.isArray(record.unsupported) || !record.unsupported.every(
            (loss) => object(loss) && typeof loss.field === "string" && typeof loss.reason === "string" && Number.isSafeInteger(loss.count) && loss.count >= 0
          )))
            throw new Error("Invalid source import metadata.");
          if (kind === "evidence") {
            if (typeof record.sourceId !== "string" || typeof record.source !== "string" || !["import", "runtime", "manual", "detector", "static"].includes(record.source))
              throw new Error("Invalid source evidence metadata.");
            const artifact = record.artifact;
            if (artifact !== void 0 && (!object(artifact) || typeof artifact.format !== "string" || !hash(artifact.sha256) || artifact.romContentSha256 !== manifest.rom.contentSha256))
              throw new Error("Invalid source artifact identity.");
          }
        }
        return records;
      };
      const sources = buildAnalysisSourceCatalog({
        imports: read("imports"),
        evidence: read("evidence")
      });
      return { manifest, sources };
    }, false);
  } finally {
    store.close();
  }
};

// packages/vscode-extension/src/disassembly-annotation-data.ts
var import_node_crypto6 = require("node:crypto");
var fs7 = __toESM(require("node:fs"));
var path7 = __toESM(require("node:path"));
init_debug_map();
init_src();
init_src3();

// packages/vscode-extension/src/disassembly-annotation-location.ts
init_src();
var annotationReferenceAt = (text, line, column) => {
  const code = (text.split(/\r?\n/)[line - 1] ?? "").split(";")[0];
  if (/^\s*[A-Z_a-z]\w*\s*:/.test(code)) return void 0;
  const token = [...code.matchAll(/[A-Z_a-z]\w*/g)].find(
    (match) => match.index <= column && column <= match.index + match[0].length
  );
  if (!token || /[\d$]/.test(code[token.index - 1] ?? "") || token.index <= code.search(/\S/) + (code.trimStart().match(/^\S+/)?.[0].length ?? 0))
    return void 0;
  return token[0];
};
var namedAnnotationLocations = (shards) => {
  const names = projectSourceLabelNames(shards.labels);
  const locations = shards.labels.map((label) => ({
    addressSpace: label.addressSpace,
    address: label.address,
    labelId: label.id,
    name: names.get(label.id)
  }));
  const addressed = new Set(
    locations.map((location) => `${location.addressSpace}:${location.address}`)
  );
  for (const record of shards.analysis) {
    if (record.kind !== "function" || addressed.has(`${record.addressSpace}:${record.address}`))
      continue;
    locations.push({
      addressSpace: record.addressSpace,
      address: record.address,
      name: `Fn_${record.address.toString(16).toUpperCase().padStart(6, "0")}`
    });
    addressed.add(`${record.addressSpace}:${record.address}`);
  }
  return locations;
};
var annotationLocationsForSource = (map, sourceId, text, line, column, shards, sources = /* @__PURE__ */ new Map([[sourceId, text]]), fileAddressSpaces = []) => {
  const lines = text.split(/\r?\n/);
  const named = namedAnnotationLocations(shards);
  const reference = annotationReferenceAt(text, line, column);
  if (reference) {
    const locations2 = [];
    for (const [id, source] of sources) {
      source.split(/\r?\n/).forEach((value, index) => {
        if (value.match(/^\s*([A-Z_a-z]\w*)\s*:/)?.[1] === reference) {
          for (const location of annotationLocationsForSource(
            map,
            id,
            source,
            index + 1,
            0,
            shards,
            sources,
            fileAddressSpaces
          ))
            locations2.push(location);
        }
      });
    }
    return locations2;
  }
  let mappedLine = line;
  const metadata = (value) => {
    const body = value.split(";")[0].trim();
    return body === "" || /^[A-Z_a-z]\w*\s*:$/.test(body) || /^\.[ai](8|16)$/.test(body);
  };
  while (mappedLine <= lines.length && metadata(lines[mappedLine - 1])) mappedLine++;
  const ranges = map.ranges.filter(
    (range) => range.sourceId === sourceId && range.line === mappedLine
  );
  const locations = /* @__PURE__ */ new Map();
  const definitionName = lines[line - 1]?.match(/^\s*([A-Z_a-z]\w*)\s*:/)?.[1];
  for (const range of ranges) {
    const fileLabels = named.filter(
      (entry) => entry.labelId && fileAddressSpaces.includes(entry.addressSpace) && entry.address === range.outputStart
    );
    const native = shards.analysis.filter(
      (record) => record.kind === "cfg-node" && (record.addressSpace === range.addressSpace && record.address === range.start || range.outputStart !== void 0 && record.fileOffset === range.outputStart)
    );
    const matches = native.length ? native.map((record) => ({ addressSpace: record.addressSpace, address: record.address })) : [{ addressSpace: range.addressSpace, address: range.start }];
    let candidates = [
      ...fileLabels,
      ...named.filter(
        (entry) => matches.some(
          (match) => entry.addressSpace === match.addressSpace && entry.address === match.address
        )
      )
    ];
    const labels = candidates.filter((entry) => entry.labelId);
    if (labels.length) candidates = labels;
    const selectedDefinition = candidates.filter((entry) => entry.name === definitionName);
    if (selectedDefinition.length) candidates = selectedDefinition;
    for (const location of candidates.length ? candidates : matches)
      locations.set(
        `${location.addressSpace}:${location.address}:${"labelId" in location ? location.labelId ?? "" : ""}`,
        location
      );
  }
  return [...locations.values()];
};

// packages/vscode-extension/src/disassembly-annotation-data.ts
var hash2 = (bytes) => (0, import_node_crypto6.createHash)("sha256").update(bytes).digest("hex");
var maps = /* @__PURE__ */ new Map();
var annotationFileSignature = (file) => {
  const stat = fs7.statSync(file, { bigint: true });
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};
var readMap = (file) => {
  const signature = annotationFileSignature(file);
  const cached = maps.get(file);
  if (cached?.signature === signature) return cached.map;
  const map = JSON.parse(fs7.readFileSync(file, "utf8"));
  if (validateDebugMap(map).length) throw new Error("Invalid debug map.");
  if (annotationFileSignature(file) !== signature)
    throw new Error("Debug map changed while loading.");
  if (maps.size >= 64) maps.clear();
  maps.set(file, { signature, map });
  return map;
};
var readSource = (source, candidate, expectedFile) => {
  const files = path7.isAbsolute(source.path) ? [source.path] : [
    ...candidate.sourceRoots.map((root) => path7.resolve(root, source.path)),
    path7.resolve(path7.dirname(candidate.file), source.path)
  ];
  for (const file of new Set(files)) {
    if (expectedFile && file !== expectedFile) continue;
    try {
      const bytes = fs7.readFileSync(file);
      if (hash2(bytes) === source.sha256) return { file, text: bytes.toString("utf8") };
    } catch {
    }
  }
  return void 0;
};
var lookupDisassemblyAnnotation = (snapshot, input) => {
  const fileSpaces = snapshot.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id);
  let locations;
  let sourceHash;
  let sourceDirectory;
  if (input.source) {
    const found = [];
    for (const candidate of input.maps) {
      let map;
      try {
        map = readMap(candidate.file);
      } catch {
        continue;
      }
      if (map.target !== snapshot.manifest.target || map.output.sha256 !== snapshot.manifest.rom.contentSha256 || map.output.size !== snapshot.manifest.rom.contentSize)
        continue;
      for (const source of map.sources) {
        if (source.sha256 !== input.source.sha256) continue;
        const current2 = readSource(source, candidate, input.source.file);
        if (!current2) continue;
        sourceHash = source.sha256;
        const texts = /* @__PURE__ */ new Map([[source.id, current2.text]]);
        if (annotationReferenceAt(current2.text, input.source.line, input.source.column)) {
          for (const other of map.sources) {
            if (other.id === source.id) continue;
            const resolved = readSource(other, candidate);
            if (resolved) texts.set(other.id, resolved.text);
          }
        }
        for (const location of annotationLocationsForSource(
          map,
          source.id,
          current2.text,
          input.source.line,
          input.source.column,
          snapshot.shards,
          texts,
          fileSpaces
        ))
          found.push(location);
      }
    }
    locations = [
      ...new Map(
        found.map((location) => [
          `${location.addressSpace}:${location.address}:${location.labelId ?? ""}`,
          location
        ])
      ).values()
    ];
    if (!sourceHash || !locations.length)
      throw new Error(
        "No exact current ROM/source mapping exists at the cursor. Run Analyze and Regenerate Disassembly, then select a label or instruction."
      );
    for (let directory = path7.dirname(input.source.file); ; directory = path7.dirname(directory)) {
      if (fs7.existsSync(path7.join(directory, "generated-files.json"))) {
        sourceDirectory = directory;
        break;
      }
      if (path7.dirname(directory) === directory) break;
    }
  } else locations = namedAnnotationLocations(snapshot.shards);
  if (!locations.length)
    throw new Error(
      "No native labels or function candidates exist. Open generated source to annotate an instruction."
    );
  const labels = new Map(snapshot.shards.labels.map((label) => [label.id, label]));
  const comments = /* @__PURE__ */ new Map();
  for (const comment of snapshot.shards.comments) {
    if (comment.placement !== "inline-instruction") continue;
    const key2 = `${comment.addressSpace}:${comment.address}`;
    const list = comments.get(key2) ?? [];
    list.push(comment);
    comments.set(key2, list);
  }
  const instructions = /* @__PURE__ */ new Set();
  for (const record of snapshot.shards.analysis) {
    if (record.kind !== "cfg-node") continue;
    instructions.add(`${record.addressSpace}:${record.address}`);
    if (record.fileOffset !== void 0)
      for (const space of fileSpaces) instructions.add(`${space}:${record.fileOffset}`);
  }
  return {
    revision: snapshot.revision,
    sourceFile: input.source?.file,
    sourceHash,
    sourceDirectory,
    choices: locations.map((location) => ({
      location,
      label: location.labelId ? labels.get(location.labelId) : void 0,
      inlineComments: comments.get(`${location.addressSpace}:${location.address}`) ?? [],
      hasInstruction: instructions.has(`${location.addressSpace}:${location.address}`)
    }))
  };
};
var saveDisassemblyAnnotation = (directory, snapshot, input) => {
  if (canonicalJson(snapshot.revision) !== canonicalJson(input.revision))
    throw new Error(
      "The analysis project changed while this form was open. Reopen the annotation and retry."
    );
  if (input.sourceFile && hash2(fs7.readFileSync(input.sourceFile)) !== input.sourceHash)
    throw new Error(
      "The source changed while this form was open. Reopen the annotation from current generated source."
    );
  const applied = applyDisassemblyAnnotationEdit(snapshot, input.request);
  if (snapshot.manifest.target === "snes.sfc")
    snesSourceLabelNames(
      applied.project.shards,
      snapshot.manifest.mapping.mapper,
      snapshot.manifest.rom.contentSize,
      input.sourceDirectory ? loadSnesRamMap(input.sourceDirectory).variables.map(({ name }) => name) : []
    );
  const { runtime: _runtime, ...updates } = applied.project.shards;
  const committed2 = commitAnalysisProjectViewUpdate(
    directory,
    { ...snapshot, view: snapshot.shards },
    updates
  );
  return { inverse: applied.inverse, snapshot: { ...committed2, shards: applied.project.shards } };
};

// packages/vscode-extension/src/analysis-worker.ts
var current;
var sqliteSnapshot = (directory) => {
  const loaded = loadAnalysisProjectViewSnapshot(directory);
  return { manifest: loaded.manifest, shards: loaded.view, revision: loaded.revision };
};
var database;
var projectDatabase = (directory) => {
  const stat = fs8.statSync(path8.join(directory, ANALYSIS_PROJECT_SQLITE_FILE), { bigint: true });
  const identity = `${stat.dev}:${stat.ino}`;
  if (database?.directory !== directory || database.identity !== identity) {
    database?.store.close();
    database = { directory, identity, store: openAnalysisProjectStore(directory) };
  }
  return database.store;
};
var readProjection = (store, snapshot, read) => store.transaction(() => {
  assertAnalysisProjectRevision(store, snapshot.revision);
  return read();
}, false);
var sqliteCoverageMap = (store, snapshot) => readProjection(
  store,
  snapshot,
  () => buildRomCoverageMap(
    snapshot.manifest,
    snapshot.shards,
    store.runtimeRecordsByKinds([
      "runtime-coverage",
      "runtime-execution",
      "runtime-memory-access"
    ])
  )
);
var request = (message) => {
  if (message.operation === "clear") {
    if (current) {
      current.coverage = void 0;
      current.sources = void 0;
      current.instructions = void 0;
      current.index = void 0;
    }
    return void 0;
  }
  if (message.operation === "sources") return readAnalysisSourceCatalog(message.directory);
  const store = projectDatabase(message.directory);
  const manifest = store.transaction(() => store.manifest(), false);
  const revision = canonicalJson(manifest);
  if (message.operation === "manifest") return manifest;
  const shardSignature = () => [ANALYSIS_PROJECT_SQLITE_FILE, `${ANALYSIS_PROJECT_SQLITE_FILE}-wal`].map((file) => {
    try {
      return annotationFileSignature(path8.join(message.directory, file));
    } catch (error) {
      if (file.endsWith("-wal") && error.code === "ENOENT")
        return "absent";
      throw error;
    }
  }).join("|");
  if (!current || current.directory !== message.directory || current.revision !== revision || current.shardSignature !== shardSignature()) {
    current = void 0;
    const project2 = sqliteSnapshot(message.directory);
    current = {
      directory: message.directory,
      revision,
      project: project2,
      shardSignature: ""
    };
    current.shardSignature = shardSignature();
  }
  const { project } = current;
  if (message.operation === "navigation") {
    if (!message.navigationTarget) throw new Error("Choose an analysis location.");
    return readProjection(
      store,
      project,
      () => projectAnalysisNavigation(
        project,
        message.navigationTarget,
        (space, address3) => store.runtimeAt(space, address3)
      )
    );
  }
  if (message.operation === "sourceSummary" || message.operation === "sourceEntries") {
    if (!message.sourceId) throw new Error("Choose a source to inspect.");
    if (!current.sources) {
      current.sources = readProjection(
        store,
        project,
        () => new AnalysisSourceIndex(project.manifest, project.shards, store.runtimeRecords())
      );
    }
    if (message.operation === "sourceSummary")
      return {
        manifest: project.manifest,
        comparison: current.sources.compare(message.sourceId, message.baselineIds)
      };
    if (!message.sourceGroup) throw new Error("Choose a source contribution group.");
    return current.sources.page(
      message.sourceId,
      message.sourceGroup,
      message.offset,
      message.baselineIds
    );
  }
  if (message.operation === "annotationLookup") {
    if (!message.annotationLookup) throw new Error("Missing annotation lookup.");
    return lookupDisassemblyAnnotation(project, message.annotationLookup);
  }
  if (message.operation === "annotationSave") {
    if (!message.annotationSave) throw new Error("Missing annotation edit.");
    const saved = saveDisassemblyAnnotation(message.directory, project, message.annotationSave);
    try {
      const published = fs8.readFileSync(path8.join(message.directory, "analysis.json"), "utf8");
      if ((0, import_node_crypto7.createHash)("sha256").update(published).digest("hex") === saved.snapshot.revision.manifestSha256) {
        current = {
          directory: message.directory,
          revision: published,
          project: saved.snapshot,
          shardSignature: ""
        };
        current.shardSignature = shardSignature();
      } else current = void 0;
    } catch {
      current = void 0;
    }
    return saved.inverse;
  }
  if (message.operation === "heuristics") {
    if (project.manifest.target !== "snes.sfc")
      throw new Error("Function heuristics require a SNES analysis project.");
    const file = path8.join(message.directory, "heuristics.json");
    const config = validateSnesHeuristicConfiguration(
      fs8.existsSync(file) ? JSON.parse(fs8.readFileSync(file, "utf8")) : {}
    );
    const result = readProjection(
      store,
      project,
      () => analyzeSnesFunctionRoles(
        project.shards,
        config,
        store.runtimeRecordsByKinds(["runtime-memory-access"])
      )
    );
    return {
      enabled: config.enabled !== false,
      total: result.roles.length,
      roles: result.roles.slice(0, 500)
    };
  }
  if (["coverage", "segments", "details"].includes(message.operation)) {
    const map = current.coverage ??= sqliteCoverageMap(store, project);
    if (message.operation === "coverage")
      return {
        ...map,
        segments: [],
        unprojected: [],
        diagnostics: [],
        detailCount: map.unprojected.length + map.diagnostics.length
      };
    const offset = message.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Invalid analysis page offset.");
    if (message.operation === "segments") return map.segments.slice(offset, offset + 200);
    const details = [];
    for (let index = offset; index < Math.min(offset + 200, map.unprojected.length + map.diagnostics.length); index++) {
      if (index < map.unprojected.length) {
        const record = map.unprojected[index];
        details.push({
          id: `${record.kind}:${record.id}:${record.reason}`,
          label: record.id,
          description: record.reason,
          icon: "debug-disconnect"
        });
      } else {
        const record = map.diagnostics[index - map.unprojected.length];
        details.push({
          id: `diagnostic:${index}`,
          label: record.recordId,
          description: "clipped",
          tooltip: record.message,
          icon: "warning"
        });
      }
    }
    return details;
  }
  if (message.operation === "graph") {
    return readProjection(store, project, () => {
      const graph = buildAnalysisCallGraph(project.shards);
      const fileSpaces = new Set(
        project.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
      );
      const indexes = new Map(
        project.manifest.addressSpaces.map(({ id }) => [
          id,
          new HalfOpenIntervalIndex(
            project.shards.annotations.filter(({ addressSpace }) => addressSpace === id)
          )
        ])
      );
      const summaries3 = [
        ...new Set(
          project.shards.analysis.flatMap(
            (record) => record.kind === "summary" ? [record.architecture] : []
          )
        )
      ];
      const hints = {};
      for (const location of [
        ...graph.functions,
        ...graph.unresolved,
        ...graph.calls.map((call) => ({
          addressSpace: call.addressSpace,
          address: call.fromAddress,
          outputOffsets: call.fromOutputOffsets
        }))
      ]) {
        const key2 = `${location.addressSpace}:${location.address}`;
        if (hints[key2]) continue;
        const annotations = [
          ...indexes.get(location.addressSpace)?.at(location.address) ?? [],
          ...[...fileSpaces].flatMap(
            (space) => location.outputOffsets.flatMap((offset) => indexes.get(space)?.at(offset) ?? [])
          )
        ];
        const runtime = store.runtimeAt(location.addressSpace, location.address);
        const architectures = [
          .../* @__PURE__ */ new Set([
            ...annotations.map(({ architecture }) => architecture),
            ...Array.from(runtime, ({ architecture }) => architecture)
          ])
        ];
        const fallback = summaries3.length === 1 ? summaries3 : [];
        hints[key2] = architectures.length ? architectures : fallback;
      }
      return { manifest: project.manifest, graph, hints };
    });
  }
  if (message.operation === "annotations" && !message.ranges?.length) return [];
  current.instructions ??= readProjection(
    store,
    project,
    () => buildInstructionAnalysisAnnotations(
      project.manifest,
      project.shards,
      () => store.runtimeRecordsByKinds([
        "runtime-execution",
        "runtime-cpu-state",
        "runtime-memory-access",
        "runtime-coverage"
      ])
    ).instructions
  );
  if (message.operation === "debugAnnotations")
    return current.instructions.map((entry) => ({
      addressSpace: entry.addressSpace,
      address: entry.address,
      outputOffsets: entry.outputOffsets,
      architectures: entry.architectures,
      text: formatInstructionAnnotationSummary(entry)
    })).filter(({ text }) => text);
  if ((message.ranges?.length ?? 0) > 2e3)
    throw new Error("At most 2000 visible source ranges may be projected per request.");
  current.index ??= createInstructionAnnotationIndex(current.instructions);
  const output = [];
  for (const range of message.ranges ?? []) {
    for (const annotation of instructionAnnotationsForDebugRange(current.index, range)) {
      output.push({ line: range.line, annotation });
      if (output.length === 2e3) return output;
    }
  }
  return output;
};
var handleMessage = (message) => {
  const send = (response) => {
    if (import_node_worker_threads.parentPort) import_node_worker_threads.parentPort.postMessage(response);
    else process.send?.(response);
  };
  try {
    send({ id: message.id, value: request(message) });
  } catch (error) {
    send({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
  }
};
if (import_node_worker_threads.parentPort) import_node_worker_threads.parentPort.on("message", handleMessage);
else {
  process.on("message", handleMessage);
  process.on("disconnect", () => process.exit(0));
}

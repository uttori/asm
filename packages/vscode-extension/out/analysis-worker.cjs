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
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key3 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key3) && key3 !== except)
        __defProp(to, key3, { get: () => from[key3], enumerable: !(desc = __getOwnPropDesc(from, key3)) || desc.enumerable });
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

// packages/core/src/canonical-json.ts
function stringifyCanonical(value) {
  return JSON.stringify(value);
}
var compareKeys, isRecord2, canonicalValue, canonicalJsonCompact, canonicalEquals, canonicalJson;
var init_canonical_json = __esm({
  "packages/core/src/canonical-json.ts"() {
    "use strict";
    compareKeys = (a, b) => a.localeCompare(b);
    isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    canonicalValue = (value) => {
      if (typeof value !== "object" || value === null) {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map(canonicalValue);
      }
      if (!isRecord2(value)) {
        return value;
      }
      const input = value;
      const result = {};
      const keys = Object.keys(input);
      if (keys.length > 1) {
        keys.sort(compareKeys);
      }
      for (const key3 of keys) {
        const entry = input[key3];
        if (entry === void 0) {
          continue;
        }
        const normalized = typeof entry === "object" && entry !== null ? canonicalValue(entry) : entry;
        if (key3 === "__proto__") {
          Object.defineProperty(result, key3, {
            value: normalized,
            enumerable: true,
            writable: true,
            configurable: true
          });
        } else {
          result[key3] = normalized;
        }
      }
      return result;
    };
    canonicalJsonCompact = (value) => stringifyCanonical(canonicalValue(value)) ?? "";
    canonicalEquals = (left, right) => left === right || canonicalJsonCompact(left) === canonicalJsonCompact(right);
    canonicalJson = (value) => `${JSON.stringify(canonicalValue(value), void 0, 2)}
`;
  }
});

// packages/vscode-extension/src/analysis/worker.ts
var worker_exports = {};
__export(worker_exports, {
  runAnalysisWorkerRequest: () => runAnalysisWorkerRequest
});
module.exports = __toCommonJS(worker_exports);
var fs9 = __toESM(require("node:fs"), 1);
var path9 = __toESM(require("node:path"), 1);
var import_node_worker_threads = require("node:worker_threads");

// packages/disassembler/src/model/project-types.ts
var ANALYSIS_PROJECT_FORMAT = "uttori-asm-analysis";
var ANALYSIS_PROJECT_SCHEMA_VERSION = 3;
var ANALYSIS_PROJECT_MANIFEST = "analysis.json";

// packages/disassembler/src/model/project-labels.ts
var validateSourceLabelName = (name2) => {
  if (typeof name2 !== "string" || name2.length > 256 || !/^[A-Z_a-z]\w*$/.test(name2)) {
    throw new Error(
      "Use a global label name containing letters, digits, and underscores, starting with a letter or underscore."
    );
  }
};

// packages/disassembler/src/model/trace-detail.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray(value) {
  return Array.isArray(value);
}
function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}
function isSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isStateValue(value) {
  return typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
}
function isMemoryAccess(entry) {
  if (!isRecord(entry)) {
    return false;
  }
  const addressSpace = entry.addressSpace;
  const address = entry.address;
  const access = entry.access;
  const width = entry.width;
  const value = entry.value;
  const actor = entry.actor;
  const channel = entry.channel;
  return typeof addressSpace === "string" && addressSpace !== "" && isSafeInteger(address) && address >= 0 && (access === "read" || access === "write" || access === "fetch") && isSafeInteger(width) && width >= 1 && width <= 8 && (value === void 0 || isSafeInteger(value) && value >= 0) && (actor === void 0 || actor === "cpu" || actor === "dma" || actor === "hdma") && (channel === void 0 || isInteger(channel) && channel >= 0 && channel <= 7 && (actor === "dma" || actor === "hdma"));
}
var validateRuntimeInstructionDetails = (value, count) => {
  if (!isUnknownArray(value) || value.length !== count) {
    throw new Error("Trace details must align one-to-one with instruction addresses.");
  }
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
    }
    const rawBytes = entry.bytes;
    if (!isUnknownArray(rawBytes) || rawBytes.length < 1 || rawBytes.length > 16) {
      throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
    }
    const bytes = [];
    for (const byte of rawBytes) {
      if (!(isInteger(byte) && byte >= 0 && byte <= 255)) {
        throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
      }
      bytes.push(byte);
    }
    const rawState = entry.state;
    if (!isRecord(rawState)) {
      throw new Error("Trace instruction state contains an invalid register value.");
    }
    const state = {};
    for (const [key3, stateValue2] of Object.entries(rawState)) {
      if (!key3 || !isStateValue(stateValue2)) {
        throw new Error("Trace instruction state contains an invalid register value.");
      }
      state[key3] = stateValue2;
    }
    const droppedMemoryAccesses = entry.droppedMemoryAccesses;
    let droppedCount;
    if (droppedMemoryAccesses !== void 0) {
      if (!(isSafeInteger(droppedMemoryAccesses) && droppedMemoryAccesses >= 0)) {
        throw new Error("Trace memory loss must be a non-negative safe integer.");
      }
      droppedCount = droppedMemoryAccesses;
    }
    const rawAccesses = entry.memoryAccesses;
    if (rawAccesses !== void 0 && (!isUnknownArray(rawAccesses) || rawAccesses.length > 256)) {
      throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
    }
    const memoryAccesses = rawAccesses === void 0 ? void 0 : rawAccesses.map((access) => {
      if (!isMemoryAccess(access)) {
        throw new Error("Trace contains an invalid bus operation.");
      }
      return access;
    });
    return {
      bytes,
      state,
      ...memoryAccesses === void 0 ? {} : { memoryAccesses },
      ...droppedCount === void 0 ? {} : { droppedMemoryAccesses: droppedCount }
    };
  });
};

// packages/disassembler/src/model/runtime-ppu-effect.ts
function isEffectRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isVramBytes(value) {
  return value === 65536 || value === 131072;
}
function isInteger2(value) {
  return typeof value === "number" && Number.isInteger(value);
}
var normalizeRuntimePPUEffect = (effect, access) => {
  const accessAddress = access.address;
  const accessValue = access.value;
  const accessDirection = access.direction;
  if (typeof accessAddress !== "number" || typeof accessValue !== "number" || typeof accessDirection !== "string") {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const port = accessAddress & 65535;
  let target = "vram";
  if (port === 8452) {
    target = "oam";
  }
  if (port === 8482) {
    target = "cgram";
  }
  const effectRecord = isEffectRecord(effect) ? effect : void 0;
  const outcome = effectRecord?.outcome;
  const forcedBlank = effectRecord?.forcedBlank;
  const renderingRestricted = effectRecord?.renderingRestricted;
  const implementation = effectRecord?.implementation;
  const vramBytes = effectRecord?.vramBytes;
  const rawBytes = effectRecord?.bytes;
  if (!effectRecord || accessDirection !== "write" || accessAddress & 4194304 || ![8452, 8472, 8473, 8482].includes(port) || effectRecord.target !== target || outcome !== "written" && outcome !== "blocked" && outcome !== "latched" || typeof forcedBlank !== "boolean" || typeof renderingRestricted !== "boolean" || forcedBlank && renderingRestricted || implementation !== "accurate" && implementation !== "performance" || (target === "vram" ? !isVramBytes(vramBytes) : vramBytes !== null) || !Array.isArray(rawBytes) || rawBytes.length > 2) {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const count = rawBytes.length;
  const capacity = target === "vram" && isVramBytes(vramBytes) ? vramBytes : null;
  if (outcome === "written" && (count === 0 || target === "vram" && count !== 1 || target === "cgram" && count !== 2) || outcome !== "written" && count !== 0 || outcome === "blocked" && (target !== "vram" || !renderingRestricted) || outcome === "latched" && (target === "vram" || renderingRestricted)) {
    throw new Error("Invalid native PPU outcome or write count.");
  }
  let bound = capacity ?? 0;
  if (target === "cgram") {
    bound = 512;
  }
  if (target === "oam") {
    bound = 544;
  }
  const byteEntries = rawBytes;
  let firstAddress = 0;
  const bytes = byteEntries.map((entry, i) => {
    const byte = isEffectRecord(entry) ? entry : void 0;
    if (!byte) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    const address = byte.address;
    const byteValue = byte.value;
    if (!isInteger2(address) || !isInteger2(byteValue)) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    if (address < 0 || address >= bound || byteValue < 0 || byteValue > 255 || target === "vram" && ((address & 1) !== (port & 1) || byteValue !== accessValue) || target === "cgram" && (i === 0 ? (address & 1) !== 0 : address !== firstAddress + 1 || byteValue !== (accessValue & 127)) || target === "oam" && i === count - 1 && byteValue !== accessValue) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    if (i === 0) {
      firstAddress = address;
    }
    return { address, value: byteValue };
  });
  return {
    target,
    outcome,
    forcedBlank,
    renderingRestricted,
    implementation,
    vramBytes: capacity,
    bytes
  };
};

// packages/disassembler/src/model/runtime-bus-types.ts
function isInteger3(value) {
  return typeof value === "number" && Number.isInteger(value);
}
var validateRuntimeBusFact = (fact) => {
  const address = fact.address;
  const pc = fact.pc;
  const value = fact.value;
  const direction = fact.direction;
  const context = fact.context;
  if (fact.addressSpace !== "snes.cpu" || !(isInteger3(address) && address >= 0 && address <= 16777215) || !(isInteger3(pc) && pc >= 0 && pc <= 16777215) || !(isInteger3(value) && value >= 0 && value <= 255) || direction !== "read" && direction !== "write" || context !== "unattributed" && context !== "instruction" && context !== "interrupt" && context !== "wait" && context !== "stop") {
    throw new Error("Invalid bus access coordinates, value, direction or context.");
  }
  const actor = fact.actor;
  const channel = fact.channel;
  const phase = fact.phase;
  if (actor === "cpu") {
    if (channel !== null || phase !== "cpu") {
      throw new Error("CPU bus accesses require a null channel and CPU phase.");
    }
  } else {
    if (!(isInteger3(channel) && channel >= 0 && channel <= 7)) {
      throw new Error("DMA/HDMA bus accesses require a channel in [0, 7].");
    }
    if (actor === "dma") {
      if (phase !== "dma") {
        throw new Error("DMA bus access has an invalid phase.");
      }
    } else if (actor === "hdma") {
      if (phase !== "hdma-table" && phase !== "hdma-indirect" && phase !== "hdma-transfer") {
        throw new Error("HDMA bus access has an invalid phase.");
      }
      if (phase !== "hdma-transfer" && direction !== "read") {
        throw new Error("HDMA table and indirect phases must be reads.");
      }
    } else {
      throw new Error("Unknown bus access actor.");
    }
  }
  if (fact.ppu !== void 0) {
    return normalizeRuntimePPUEffect(fact.ppu, { address, direction, value });
  }
  return void 0;
};

// packages/disassembler/src/analysis/analysis-sources.ts
var sorted = (values) => [...new Set(values)].toSorted();
var key = (...values) => JSON.stringify(values);
var buildAnalysisSourceCatalog = (shards, importTimes = /* @__PURE__ */ new Map()) => {
  const sources = /* @__PURE__ */ new Map();
  const ensure = (id, name2, format, sha256) => {
    let source = sources.get(id);
    if (!source) {
      source = {
        id,
        names: /* @__PURE__ */ new Set(),
        kinds: /* @__PURE__ */ new Set(),
        format,
        sha256,
        evidenceIds: [],
        reports: []
      };
      sources.set(id, source);
    }
    source.names.add(name2);
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
    if (artifact) {
      id = key("artifact", artifact.format, artifact.sha256);
    } else if (legacy.length === 1) {
      id = reportSources.get(legacy[0].id);
    }
    const source = sources.get(id) ?? ensure(id, evidence.sourceId, artifact?.format, artifact?.sha256);
    source.kinds.add(evidence.source);
    source.evidenceIds.push(evidence.id);
  }
  return [...sources.values()].map(
    (source) => Object.assign(
      {},
      source,
      source.sha256 && importTimes.has(source.sha256) ? { lastImportedAt: importTimes.get(source.sha256) } : {},
      {
        names: sorted(source.names),
        name: sorted(source.names).join(" / "),
        kinds: [...source.kinds].toSorted(),
        evidenceIds: sorted(source.evidenceIds),
        reports: source.reports.toSorted((a, b) => a.id.localeCompare(b.id))
      }
    )
  ).toSorted(
    (a, b) => (b.lastImportedAt ?? -1) - (a.lastImportedAt ?? -1) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
};

// packages/disassembler/src/analysis/instruction-annotations.ts
init_canonical_json();
var sortedStrings = (values) => values ? [...new Set(values)].toSorted((left, right) => left.localeCompare(right)) : [];
var sortedNumbers = (values) => values ? [...new Set(values)].toSorted((left, right) => left - right) : [];
var valueKey = (value, present) => present ? canonicalJsonCompact(value) : "<absent>";
var locationKey = (addressSpace, address) => `${addressSpace}:${address}`;
var addValue = (target, value) => {
  const values = target ?? /* @__PURE__ */ new Set();
  values.add(value);
  return values;
};
var addAll = (target, values) => {
  if (values.length === 0) {
    return target;
  }
  target ??= /* @__PURE__ */ new Set();
  for (const value of values) {
    target.add(value);
  }
  return target;
};
var numberField = (record2, name2) => {
  const value = record2[name2];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
};
var effectiveAddress = (value) => {
  const operandIndex = numberField(value, "operandIndex");
  if (operandIndex === void 0 || typeof value.volatile !== "boolean" || typeof value.explanation !== "string") {
    return void 0;
  }
  const address = numberField(value, "address");
  const baseAddress = numberField(value, "baseAddress");
  const romOffset = numberField(value, "romOffset");
  const symbol = typeof value.symbol === "string" && value.symbol.length > 0 ? value.symbol : void 0;
  return {
    operandIndex,
    ...address === void 0 ? {} : { address },
    ...baseAddress === void 0 ? {} : { baseAddress },
    ...symbol === void 0 ? {} : { symbol },
    volatile: value.volatile,
    ...romOffset === void 0 ? {} : { romOffset },
    explanation: value.explanation
  };
};
var annotationState = (annotation) => annotation.state;
var runtimeState = (record2) => record2.state;
var lowerBound = (values, target, at) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (at(values[middle]) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};
var buildInstructionAnalysisAnnotations = (manifest, shards, runtime = () => shards.runtime) => {
  const fileAddressSpaces = new Set(
    manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
  );
  const instructions = /* @__PURE__ */ new Map();
  const diagnostics = [];
  const ensure = (addressSpace, address) => {
    const key3 = locationKey(addressSpace, address);
    let instruction = instructions.get(key3);
    if (!instruction) {
      instruction = {
        addressSpace,
        address,
        executionCount: 0
      };
      instructions.set(key3, instruction);
    }
    return instruction;
  };
  const addStateObservation = (instruction, source, architecture, state, recordId, evidence, count) => {
    const stateKey = canonicalJsonCompact(state);
    const key3 = `${source}:${architecture}:${stateKey}`;
    const observations = instruction.stateObservations ??= /* @__PURE__ */ new Map();
    let observation = observations.get(key3);
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
      observations.set(key3, observation);
    }
    if (count !== void 0) {
      observation.count = (observation.count ?? 0) + count;
    }
    observation.recordIds.add(recordId);
    addAll(observation.evidence, evidence);
    instruction.architectures = addValue(instruction.architectures, architecture);
    instruction.evidence = addAll(instruction.evidence, evidence);
  };
  const addNode = (node) => {
    const instruction = ensure(node.addressSpace, node.address);
    instruction.nodeIds = addValue(instruction.nodeIds, node.id);
    if (node.fileOffset !== void 0) {
      instruction.outputOffsets = addValue(instruction.outputOffsets, node.fileOffset);
    }
    instruction.evidence = addAll(instruction.evidence, node.evidence);
    for (const raw of node.effectiveAddresses) {
      const value = effectiveAddress(raw);
      if (!value) {
        diagnostics.push({
          recordId: node.id,
          message: "Ignored malformed effective-address metadata. Required operandIndex, volatile, and explanation fields were not valid."
        });
        continue;
      }
      const key3 = canonicalJsonCompact(value);
      const addresses = instruction.effectiveAddresses ??= /* @__PURE__ */ new Map();
      let entry = addresses.get(key3);
      if (!entry) {
        entry = { value, nodeIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
        addresses.set(key3, entry);
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
      if (beforeKey === afterKey) {
        continue;
      }
      const key3 = `${field}:${beforeKey}:${afterKey}`;
      const transitions = instruction.stateTransitions ??= /* @__PURE__ */ new Map();
      let transition = transitions.get(key3);
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
        transitions.set(key3, transition);
      }
      transition.nodeIds.add(node.id);
      addAll(transition.evidence, node.evidence);
    }
  };
  for (const record2 of shards.analysis) {
    if (record2.kind === "cfg-node") {
      addNode(record2);
    }
  }
  for (const annotation of shards.annotations) {
    if (annotation.classification !== "opcode") {
      continue;
    }
    const instruction = ensure(annotation.addressSpace, annotation.start);
    if (fileAddressSpaces.has(annotation.addressSpace)) {
      instruction.outputOffsets = addValue(instruction.outputOffsets, annotation.start);
    }
  }
  for (const record2 of runtime()) {
    if (record2.kind === "runtime-execution") {
      const instruction = ensure(record2.addressSpace, record2.address);
      if (record2.fileOffset !== void 0) {
        instruction.outputOffsets = addValue(instruction.outputOffsets, record2.fileOffset);
      }
      instruction.architectures = addValue(instruction.architectures, record2.architecture);
      instruction.executionCount += record2.count;
      instruction.executionRecordIds = addValue(instruction.executionRecordIds, record2.id);
      instruction.evidence = addAll(instruction.evidence, record2.evidence);
    } else if (record2.kind === "runtime-cpu-state") {
      const instruction = ensure(record2.addressSpace, record2.address);
      addStateObservation(
        instruction,
        "runtime",
        record2.architecture,
        runtimeState(record2),
        record2.id,
        record2.evidence,
        record2.count
      );
    } else if (record2.kind === "runtime-memory-access") {
      const instruction = ensure(record2.instructionAddressSpace, record2.instructionAddress);
      instruction.architectures = addValue(instruction.architectures, record2.architecture);
      const value = {
        accessedAddressSpace: record2.accessedAddressSpace,
        accessedAddress: record2.accessedAddress,
        access: record2.access,
        width: record2.width,
        ...record2.actor === void 0 ? {} : { actor: record2.actor },
        ...record2.channel === void 0 ? {} : { channel: record2.channel },
        ...record2.value === void 0 ? {} : { value: record2.value }
      };
      const key3 = canonicalJsonCompact(value);
      const accesses = instruction.memoryAccesses ??= /* @__PURE__ */ new Map();
      let access = accesses.get(key3);
      if (!access) {
        access = { value, count: 0, recordIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
        accesses.set(key3, access);
      }
      access.count += record2.count;
      access.recordIds.add(record2.id);
      addAll(access.evidence, record2.evidence);
      instruction.evidence = addAll(instruction.evidence, record2.evidence);
    }
  }
  for (const comment of shards.comments) {
    const instruction = ensure(comment.addressSpace, comment.address);
    (instruction.comments ??= []).push(comment);
    for (const evidence of comment.evidence) {
      (instruction.evidence ??= /* @__PURE__ */ new Set()).add(evidence);
    }
  }
  const mutable = [...instructions.values()];
  const directIndex = /* @__PURE__ */ new Map();
  const outputIndex = [];
  for (const instruction of mutable) {
    const direct = directIndex.get(instruction.addressSpace);
    if (direct) {
      direct.push(instruction);
    } else {
      directIndex.set(instruction.addressSpace, [instruction]);
    }
    for (const offset of instruction.outputOffsets ?? []) {
      outputIndex.push({ offset, instruction });
    }
  }
  for (const values of directIndex.values()) {
    values.sort((left, right) => left.address - right.address);
  }
  outputIndex.sort((left, right) => left.offset - right.offset);
  const attachToRange = (addressSpace, start, end, callback) => {
    const direct = directIndex.get(addressSpace) ?? [];
    for (let index = lowerBound(direct, start, ({ address }) => address); index < direct.length && direct[index].address < end; index++) {
      callback(direct[index]);
    }
    if (fileAddressSpaces.has(addressSpace)) {
      for (let index = lowerBound(outputIndex, start, ({ offset }) => offset); index < outputIndex.length && outputIndex[index].offset < end; index++) {
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
  for (const record2 of runtime()) {
    if (record2.kind !== "runtime-coverage") {
      continue;
    }
    coverageById.set(record2.id, record2);
    attachToRange(record2.addressSpace, record2.start, record2.end, (instruction) => {
      instruction.architectures = addValue(instruction.architectures, record2.architecture);
      instruction.coverageRecordIds = addValue(instruction.coverageRecordIds, record2.id);
      instruction.evidence = addAll(instruction.evidence, record2.evidence);
    });
  }
  const summaries = new Set(
    shards.analysis.filter((record2) => record2.kind === "summary").map(({ architecture }) => architecture)
  );
  if (summaries.size === 1) {
    const [architecture] = summaries;
    for (const instruction of mutable) {
      if (architecture && (instruction.architectures?.size ?? 0) === 0) {
        instruction.architectures = addValue(instruction.architectures, architecture);
      }
    }
  }
  const finalized = mutable.map((instruction) => {
    const coverage = /* @__PURE__ */ new Map();
    for (const recordId of instruction.coverageRecordIds ?? []) {
      const record2 = coverageById.get(recordId);
      const previous = coverage.get(record2.coverage);
      coverage.set(record2.coverage, {
        coverage: record2.coverage,
        count: (previous?.count ?? 0) + record2.count,
        recordIds: sortedStrings([...previous?.recordIds ?? [], record2.id]),
        evidence: sortedStrings([...previous?.evidence ?? [], ...record2.evidence])
      });
    }
    return Object.assign(
      {
        id: `instruction:${instruction.addressSpace}:${instruction.address}`,
        addressSpace: instruction.addressSpace,
        address: instruction.address,
        outputOffsets: sortedNumbers(instruction.outputOffsets),
        architectures: sortedStrings(instruction.architectures),
        nodeIds: sortedStrings(instruction.nodeIds),
        effectiveAddresses: [...instruction.effectiveAddresses?.values() ?? []].map(
          ({ value, nodeIds, evidence }) => Object.assign({}, value, {
            nodeIds: sortedStrings(nodeIds),
            evidence: sortedStrings(evidence)
          })
        ).toSorted(
          (left, right) => left.operandIndex - right.operandIndex || (left.address ?? left.baseAddress ?? -1) - (right.address ?? right.baseAddress ?? -1) || left.explanation.localeCompare(right.explanation)
        ),
        stateTransitions: [...instruction.stateTransitions?.values() ?? []].toSorted(
          (left, right) => left.field.localeCompare(right.field) || left.beforeKey.localeCompare(right.beforeKey) || left.afterKey.localeCompare(right.afterKey)
        ).map(
          ({ field, before, after, nodeIds, evidence }) => Object.assign(
            Object.assign(
              {},
              { field },
              before === void 0 ? {} : { before },
              after === void 0 ? {} : { after }
            ),
            {
              nodeIds: sortedStrings(nodeIds),
              evidence: sortedStrings(evidence)
            }
          )
        ),
        stateObservations: [...instruction.stateObservations?.values() ?? []].toSorted(
          (left, right) => left.source.localeCompare(right.source) || left.architecture.localeCompare(right.architecture) || left.stateKey.localeCompare(right.stateKey)
        ).map(
          ({ source, architecture, state, count, recordIds, evidence }) => Object.assign(
            {},
            { source, architecture, state },
            count === void 0 ? {} : { count },
            {
              recordIds: sortedStrings(recordIds),
              evidence: sortedStrings(evidence)
            }
          )
        ),
        executionCount: instruction.executionCount
      },
      instruction.comments ? { comments: instruction.comments.toSorted((a, b) => a.id.localeCompare(b.id)) } : {},
      {
        executionRecordIds: sortedStrings(instruction.executionRecordIds),
        runtimeCoverage: [...coverage.values()].toSorted(
          (left, right) => left.coverage.localeCompare(right.coverage)
        ),
        memoryAccesses: [...instruction.memoryAccesses?.values() ?? []].map(
          ({ value, count, recordIds, evidence }) => Object.assign({}, value, {
            count,
            recordIds: sortedStrings(recordIds),
            evidence: sortedStrings(evidence)
          })
        ).toSorted(
          (left, right) => left.accessedAddressSpace.localeCompare(right.accessedAddressSpace) || left.accessedAddress - right.accessedAddress || left.access.localeCompare(right.access) || left.width - right.width || (left.value ?? -1) - (right.value ?? -1)
        ),
        evidence: sortedStrings(instruction.evidence)
      }
    );
  });
  return {
    instructions: finalized.toSorted(
      (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
    ),
    diagnostics: diagnostics.toSorted(
      (left, right) => left.recordId.localeCompare(right.recordId) || left.message.localeCompare(right.message)
    )
  };
};

// packages/disassembler/src/model/research-mapping.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isResearchMapping(value) {
  if (!isRecord3(value)) {
    return false;
  }
  const record2 = value;
  if (Object.keys(record2).some((key3) => key3 !== "fileOffset" && key3 !== "state")) {
    return false;
  }
  if (record2.fileOffset !== void 0 && !(Number.isSafeInteger(record2.fileOffset) && Number(record2.fileOffset) >= 0)) {
    return false;
  }
  let fields = 0;
  if (record2.state !== void 0) {
    if (typeof record2.state !== "object" || record2.state === null || Array.isArray(record2.state)) {
      return false;
    }
    const entries = Object.entries(record2.state);
    if (entries.length === 0 || entries.length > 64) {
      return false;
    }
    for (const [key3, entry] of entries) {
      if (!/^[A-Za-z][\w.]{0,63}$/.test(key3) || typeof entry !== "boolean" && !(Number.isSafeInteger(entry) && Number(entry) >= 0)) {
        return false;
      }
    }
    fields = entries.length;
  }
  return record2.fileOffset !== void 0 || fields > 0;
}

// packages/disassembler/src/analysis/project-evidence.ts
var evidenceReferences = (shards, evidenceId) => [
  ...shards.analysis.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `analysis:${record2.id}`),
  ...shards.annotations.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `annotations:${record2.id}`),
  ...shards.labels.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `labels:${record2.id}`),
  ...shards.comments.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `comments:${record2.id}`),
  ...shards.regions.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `regions:${record2.id}`),
  ...shards.runtime.filter((record2) => record2.evidence.includes(evidenceId)).map((record2) => `runtime:${record2.id}`)
];
var sortedUnique = (values) => [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
var explainProjectEvidence = (shards, shard, recordId) => {
  const records = shards[shard];
  const record2 = records.find(({ id }) => id === recordId);
  if (!record2) {
    throw new Error(`Analysis ${shard} record '${recordId}' does not exist.`);
  }
  let evidenceIds = [];
  if (shard === "evidence") {
    evidenceIds = [record2.id];
  } else if ("evidence" in record2) {
    evidenceIds = record2.evidence;
  }
  const evidence = evidenceIds.map((id) => {
    const found = shards.evidence.find((entry) => entry.id === id);
    if (!found) {
      throw new Error(`Analysis record '${recordId}' refers to missing evidence '${id}'.`);
    }
    return found;
  });
  const referencedBy = sortedUnique(evidenceIds.flatMap((id) => evidenceReferences(shards, id)));
  const evidenceSet = new Set(evidenceIds);
  const conflicts = shards.analysis.filter(
    (entry) => entry.kind === "conflict" && (entry.id === recordId || entry.nodes.includes(recordId) || entry.evidence.some((id) => evidenceSet.has(id)))
  ).toSorted((left, right) => left.id.localeCompare(right.id));
  return { shard, record: record2, evidence, referencedBy, conflicts };
};

// packages/disassembler/src/runtime/runtime-evidence.ts
init_canonical_json();
var emptyCounts = () => ({
  analysis: 0,
  annotations: 0,
  labels: 0,
  comments: 0,
  regions: 0,
  runtime: 0,
  evidence: 0,
  imports: 0
});
var sortedUnique2 = (values) => [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
var stateValueKey = (value) => `${typeof value}:${String(value)}`;
var conflictReport = (runtime) => {
  const observations = [];
  for (const record2 of runtime) {
    if (record2.kind === "runtime-cpu-state") {
      for (const [field, value] of Object.entries(record2.state)) {
        observations.push({
          architecture: record2.architecture,
          addressSpace: record2.addressSpace,
          address: record2.address,
          field,
          value,
          record: record2.id,
          evidence: record2.evidence
        });
      }
    } else if (record2.kind === "runtime-execution") {
      if (record2.size !== void 0) {
        observations.push({
          architecture: record2.architecture,
          addressSpace: record2.addressSpace,
          address: record2.address,
          field: "instruction-size",
          value: record2.size,
          record: record2.id,
          evidence: record2.evidence
        });
      }
      if (record2.opcode !== void 0) {
        observations.push({
          architecture: record2.architecture,
          addressSpace: record2.addressSpace,
          address: record2.address,
          field: "opcode",
          value: record2.opcode,
          record: record2.id,
          evidence: record2.evidence
        });
      }
    }
  }
  const groups = /* @__PURE__ */ new Map();
  for (const observation of observations) {
    const key3 = [
      observation.architecture,
      observation.addressSpace,
      observation.address,
      observation.field
    ].join(":");
    const group = groups.get(key3);
    if (group) {
      group.push(observation);
    } else {
      groups.set(key3, [observation]);
    }
  }
  const conflicts = [];
  for (const [key3, group] of groups) {
    const byValue = /* @__PURE__ */ new Map();
    for (const observation of group) {
      const valueKey2 = stateValueKey(observation.value);
      const entries = byValue.get(valueKey2);
      if (entries) {
        entries.push(observation);
      } else {
        byValue.set(valueKey2, [observation]);
      }
    }
    if (byValue.size < 2) {
      continue;
    }
    const first = group[0];
    conflicts.push({
      id: `runtime-conflict:${key3}`,
      kind: first.field === "instruction-size" || first.field === "opcode" ? first.field : "cpu-state",
      architecture: first.architecture,
      addressSpace: first.addressSpace,
      address: first.address,
      field: first.field,
      values: [...byValue.values()].map((entries) => ({
        value: entries[0].value,
        records: sortedUnique2(entries.map((entry) => entry.record)),
        evidence: sortedUnique2(entries.flatMap((entry) => entry.evidence))
      })).toSorted(
        (left, right) => stateValueKey(left.value).localeCompare(stateValueKey(right.value))
      )
    });
  }
  return conflicts.toSorted((left, right) => left.id.localeCompare(right.id));
};
var explanationReport = (shards) => {
  const runtimeEvidence = new Set(
    shards.evidence.filter((record2) => record2.source === "runtime").map((record2) => record2.id)
  );
  const explanations = [];
  for (const annotation of shards.annotations) {
    const evidence = annotation.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    const stateFields = Object.keys(annotation.state ?? {}).toSorted();
    explanations.push({
      recordId: annotation.id,
      detail: stateFields.length > 0 ? `Runtime observation supplies ${stateFields.join(", ")} state.` : `Runtime observation classifies bytes as ${annotation.classification}.`,
      evidence: sortedUnique2(evidence)
    });
  }
  for (const record2 of shards.analysis) {
    if (record2.kind !== "target-override") {
      continue;
    }
    const evidence = record2.evidence.filter((id) => runtimeEvidence.has(id));
    if (evidence.length === 0) {
      continue;
    }
    explanations.push({
      recordId: record2.id,
      detail: `Runtime observation resolves control flow to ${record2.targets.map((target) => `$${target.toString(16).toUpperCase().padStart(6, "0")}`).join(", ")}.`,
      evidence: sortedUnique2(evidence)
    });
  }
  return explanations.toSorted((left, right) => left.recordId.localeCompare(right.recordId));
};
var mergeRecords = (kind, prior, incoming, added, updated, existing, combine) => {
  if (incoming.length === 0) {
    return prior;
  }
  const records = new Map(prior.map((record2) => [record2.id, record2]));
  for (const record2 of incoming) {
    const current = records.get(record2.id);
    if (!current) {
      records.set(record2.id, record2);
      added[kind]++;
    } else if (canonicalEquals(current, record2)) {
      existing[kind]++;
    } else if (combine) {
      const merged = combine(current, record2);
      if (!merged) {
        throw new Error(
          `Runtime evidence id '${record2.id}' in '${kind}' changed content. Use a content-derived id.`
        );
      }
      if (canonicalEquals(current, merged)) {
        existing[kind]++;
      } else {
        records.set(record2.id, merged);
        updated[kind]++;
      }
    } else {
      throw new Error(
        `Runtime evidence id '${record2.id}' in '${kind}' changed content. Use a content-derived id.`
      );
    }
  }
  return [...records.values()];
};
var mergeRuntimeEvidence = (shards, batch) => {
  const traceProfiles = /* @__PURE__ */ new Map();
  for (const report of [...shards.imports, ...batch.imports ?? []]) {
    if (report.format !== "uttori-asm-instruction-trace") {
      continue;
    }
    if (traceProfiles.has(report.sourceSha256) && traceProfiles.get(report.sourceSha256) !== report.indexProfile) {
      throw new Error(
        `Trace '${report.sourceName}' has incompatible retained facts. Import into a separate project to avoid double-counting observations.`
      );
    }
    traceProfiles.set(report.sourceSha256, report.indexProfile);
  }
  const added = emptyCounts();
  const updated = emptyCounts();
  const existing = emptyCounts();
  const merged = {
    analysis: mergeRecords(
      "analysis",
      shards.analysis,
      batch.analysis ?? [],
      added,
      updated,
      existing,
      (current, record2) => {
        if (current.kind !== "target-override" || record2.kind !== "target-override" || !current.id.startsWith("runtime:target-override:")) {
          return void 0;
        }
        if (current.addressSpace !== record2.addressSpace || current.address !== record2.address) {
          throw new Error(`Runtime target override '${record2.id}' changed its control-flow site.`);
        }
        return {
          ...current,
          targets: [.../* @__PURE__ */ new Set([...current.targets, ...record2.targets])].toSorted((a, b) => a - b),
          evidence: sortedUnique2([...current.evidence, ...record2.evidence])
        };
      }
    ),
    annotations: mergeRecords(
      "annotations",
      shards.annotations,
      batch.annotations ?? [],
      added,
      updated,
      existing
    ),
    labels: mergeRecords("labels", shards.labels, batch.labels ?? [], added, updated, existing),
    comments: mergeRecords(
      "comments",
      shards.comments,
      batch.comments ?? [],
      added,
      updated,
      existing
    ),
    regions: mergeRecords("regions", shards.regions, batch.regions ?? [], added, updated, existing),
    runtime: mergeRecords("runtime", shards.runtime, batch.runtime ?? [], added, updated, existing),
    evidence: mergeRecords(
      "evidence",
      shards.evidence,
      batch.evidence ?? [],
      added,
      updated,
      existing
    ),
    imports: mergeRecords("imports", shards.imports, batch.imports ?? [], added, updated, existing)
  };
  let conflicts;
  let explanations;
  return {
    shards: merged,
    changed: Object.values(added).some((count) => count > 0) || Object.values(updated).some((count) => count > 0),
    added,
    updated,
    existing,
    get conflicts() {
      return conflicts ??= conflictReport(merged.runtime);
    },
    get explanations() {
      return explanations ??= explanationReport(merged);
    }
  };
};
var inspectRuntimeEvidence = (shards) => ({
  conflicts: conflictReport(shards.runtime),
  explanations: explanationReport(shards)
});

// packages/disassembler/src/internal/trace-cache.ts
var TraceCache = class {
  #entries = /* @__PURE__ */ new Map();
  /** Dense victim slots avoid scanning the Map. Hits never reorder either structure. */
  #keys = [];
  #metrics;
  #random = 2654435769;
  constructor(metrics) {
    this.#metrics = metrics;
  }
  /** Look up a value. Undefined is reserved for misses.
   * @param {string} key Complete semantic key, never a lossy coordinate projection.
   * @returns {T | undefined} Retained value, or a cache miss.
   */
  get(key3) {
    const value = this.#entries.get(key3);
    if (this.#metrics) {
      if (value === void 0) {
        this.#metrics.misses++;
      } else {
        this.#metrics.hits++;
      }
    }
    return value;
  }
  /** Insert a missing key, returning the displaced entry so its owner can flush it.
   * Existing keys must be updated through their caller-owned mutable value instead.
   * @param {string} key Previously missing semantic key.
   * @param {T} value Defined value whose ownership stays with the caller.
   * @returns {object | undefined} Displaced key/value, or undefined while filling unused capacity.
   */
  insert(key3, value) {
    let displaced;
    if (this.#keys.length === 4096) {
      let random = this.#random;
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      this.#random = random;
      const slot = random & 4095;
      const victim = this.#keys[slot];
      displaced = { key: victim, value: this.#entries.get(victim) };
      this.#entries.delete(victim);
      this.#keys[slot] = key3;
      if (this.#metrics) {
        this.#metrics.evictions++;
      }
    } else {
      this.#keys.push(key3);
      if (this.#metrics) {
        this.#metrics.peakEntries = Math.max(this.#metrics.peakEntries, this.#keys.length);
      }
    }
    this.#entries.set(key3, value);
    return displaced;
  }
  /** Iterate the retained working set, for a final durable delta flush.
   * @returns {MapIterator} Live entries. Do not insert while iterating.
   */
  entries() {
    return this.#entries.entries();
  }
  /** Drop retained values after a flush or failed import. Diagnostics remain cumulative. */
  clear() {
    this.#entries.clear();
    this.#keys.length = 0;
    this.#random = 2654435769;
  }
};

// packages/disassembler/src/storage/sqlite-store.ts
var import_node_crypto4 = require("node:crypto");
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);
var import_node_sqlite2 = require("node:sqlite");
init_canonical_json();

// packages/disassembler/src/internal/record-id-set.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_sqlite = require("node:sqlite");
var RecordIdSet = class {
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
    if (this.#insert) {
      return this.#insert.run(id).changes !== 0;
    }
    if (this.#ids.has(id)) {
      return false;
    }
    this.#ids.add(id);
    this.#characters += id.length;
    if (this.#characters > 4 * 1024 * 1024) {
      this.#spill();
    }
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
      for (const id of this.#ids) {
        this.#insert.run(id);
      }
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
      if (this.#directory) {
        import_node_fs.default.rmSync(this.#directory, { recursive: true, force: true });
      }
      this.#directory = void 0;
    }
  }
};

// packages/disassembler/src/model/analysis-ownership.ts
function validateAnalysisOwnership(records, scope = "complete") {
  if (!records.some(
    (record2) => record2.kind === "cfg-node" && (record2.functionEntry !== void 0 || record2.evidencePredecessor !== void 0)
  )) {
    return;
  }
  const nodes = /* @__PURE__ */ new Map();
  for (const record2 of records) {
    if (record2.kind === "cfg-node") {
      nodes.set(record2.id, record2);
    }
  }
  const complete = /* @__PURE__ */ new Set();
  for (const node of nodes.values()) {
    if (node.functionEntry === void 0) {
      if (node.evidencePredecessor !== void 0) {
        throw new Error(`Analysis node '${node.id}' has a predecessor without function ownership.`);
      }
      continue;
    }
    const entry = nodes.get(node.functionEntry);
    if (!entry && scope === "complete" || entry && (entry.functionEntry !== entry.id || entry.addressSpace !== node.addressSpace)) {
      throw new Error(`Analysis node '${node.id}' has an invalid function entry.`);
    }
    const visiting = /* @__PURE__ */ new Set();
    let current = node;
    while (!complete.has(current.id)) {
      if (visiting.has(current.id)) {
        throw new Error(`Analysis node '${current.id}' has a cyclic evidence predecessor.`);
      }
      visiting.add(current.id);
      const predecessor = current.evidencePredecessor;
      if (predecessor === void 0) {
        if (current.id !== node.functionEntry) {
          throw new Error(`Analysis node '${current.id}' does not lead to its function entry.`);
        }
        break;
      }
      const previous = nodes.get(predecessor);
      if (current.id === node.functionEntry || !previous && scope === "complete" || previous && (previous.functionEntry !== node.functionEntry || previous.addressSpace !== node.addressSpace)) {
        throw new Error(`Analysis node '${current.id}' has an invalid evidence predecessor.`);
      }
      if (!previous) {
        break;
      }
      current = previous;
    }
    for (const id of visiting) {
      complete.add(id);
    }
  }
}

// packages/disassembler/src/model/runtime-graphics-fact.ts
var record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var unsigned = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
var name = (value) => typeof value === "string" && /^[A-Za-z][\w.-]{0,63}$/.test(value);
function isRuntimeGraphicsFact(value) {
  if (!record(value) || !name(value.addressSpace) || !unsigned(value.address) || !unsigned(value.pc) || !name(value.actor) || value.context !== "instruction" && value.context !== "interrupt" && value.context !== "unattributed" || value.direction !== "read" && value.direction !== "write" || !unsigned(value.value) || value.value > 255) {
    return false;
  }
  if (value.cpuMapping !== null && (!record(value.cpuMapping) || !name(value.cpuMapping.offsetStateField) || !unsigned(value.cpuMapping.physicalOffset))) {
    return false;
  }
  if (value.effect === null) {
    return true;
  }
  const effect = value.effect;
  if (!record(effect) || !name(effect.target) || value.direction !== "write" || !Array.isArray(effect.bytes) || effect.bytes.length > 16) {
    return false;
  }
  if (effect.outcome === "blocked") {
    return effect.bytes.length === 0;
  }
  return effect.outcome === "written" && effect.bytes.length > 0 && effect.bytes.every(
    (byte) => record(byte) && unsigned(byte.offset) && unsigned(byte.value) && byte.value <= 255
  );
}

// packages/disassembler/src/model/project-validation.ts
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function isRowRecord(value) {
  return !Array.isArray(value);
}
function isSafeInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function validateAnalysisProjectManifest(manifest) {
  if (typeof manifest !== "object" || manifest === null || !isRowRecord(manifest)) {
    throw new Error("Unsupported analysis project format 'undefined'.");
  }
  if (manifest.format !== ANALYSIS_PROJECT_FORMAT) {
    throw new Error(`Unsupported analysis project format '${String(manifest.format)}'.`);
  }
  if (manifest.schemaVersion !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported analysis project schema version ${String(manifest.schemaVersion)}.`
    );
  }
  const rom = manifest.rom;
  if (!isObject(rom) || typeof rom.sha256 !== "string" || !/^[\da-f]{64}$/.test(rom.sha256)) {
    throw new Error("Invalid ROM SHA-256.");
  }
  if (typeof rom.contentSha256 !== "string" || !/^[\da-f]{64}$/.test(rom.contentSha256)) {
    throw new Error("Invalid ROM content SHA-256.");
  }
  if (!Array.isArray(manifest.addressSpaces)) {
    throw new Error("Analysis address spaces require non-empty ids and names.");
  }
  const addressSpaceIds = /* @__PURE__ */ new Set();
  for (const entry of manifest.addressSpaces) {
    if (!isObject(entry)) {
      throw new Error("Analysis address spaces require non-empty ids and names.");
    }
    const id = entry.id;
    const name2 = entry.name;
    if (typeof id !== "string" || id === "" || typeof name2 !== "string" || name2 === "") {
      throw new Error("Analysis address spaces require non-empty ids and names.");
    }
    if (addressSpaceIds.has(id)) {
      throw new Error(`Duplicate analysis address-space id '${id}'.`);
    }
    const addressBits = entry.addressBits;
    if (!(isSafeInteger2(addressBits) && addressBits > 0 && addressBits <= 53)) {
      throw new Error(`Analysis address space '${id}' has invalid address bits.`);
    }
    addressSpaceIds.add(id);
  }
  const db = manifest.db;
  if (db !== void 0 && db !== "analysis.sqlite") {
    const pathText = typeof db === "string" ? db : JSON.stringify(db);
    throw new Error(`Unsupported analysis sqlite path '${pathText}'.`);
  }
  const revision = manifest.revision;
  if (revision !== void 0 && !(isSafeInteger2(revision) && revision >= 0)) {
    throw new Error("Invalid analysis sqlite revision.");
  }
  if (!Array.isArray(manifest.shards) || manifest.shards.length !== 0) {
    throw new Error("Legacy analysis shards are no longer supported. Use a SQLite project.");
  }
}
var FORBIDDEN_ROM_PAYLOAD_KEYS = /* @__PURE__ */ new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);
var assertNoRomPayload = (value, location) => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const entry = value[index];
      if (entry && typeof entry === "object") {
        assertNoRomPayload(entry, `${location}[${index}]`);
      }
    }
    return;
  }
  if (!value || typeof value !== "object" || !isRowRecord(value)) {
    return;
  }
  const record2 = value;
  for (const key3 in record2) {
    if (!Object.hasOwn(record2, key3)) {
      continue;
    }
    if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key3)) {
      throw new Error(`ROM byte payload '${location}.${key3}' is forbidden in analysis projects.`);
    }
    const entry = record2[key3];
    if (entry && typeof entry === "object") {
      assertNoRomPayload(entry, `${location}.${key3}`);
    }
  }
};
var isAlphaNumeric = (character) => {
  const code = character.charCodeAt(0);
  return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
};
var isStableId = (id) => {
  if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1))) {
    return false;
  }
  for (const character of id) {
    if (!isAlphaNumeric(character) && !"._:/-".includes(character)) {
      return false;
    }
  }
  return true;
};
var visitJson = (value, current) => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitJson(entry, `${current}[${index}]`));
    return;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    Object.entries(value).forEach(([key3, entry]) => visitJson(entry, `${current}.${key3}`));
    return;
  }
  throw new Error(`${current} is not a JSON-safe codec option.`);
};
var assertCodecReference = (reference, location) => {
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
  if (reference.options !== void 0) {
    visitJson(reference.options, `${location} options`);
  }
};
var createRuntimeRecordValidator = (project, evidence, checkDuplicateIds = true) => {
  const ids = checkDuplicateIds ? new RecordIdSet() : void 0;
  const evidenceIds = new Set(evidence.map((record2) => record2.id));
  const addressSpaceById = new Map(project.addressSpaces.map((space) => [space.id, space]));
  const validate = (record2) => {
    if (!record2 || typeof record2.id !== "string" || record2.id === "") {
      throw new Error("Analysis shard 'runtime' contains a record without an id.");
    }
    if (ids && !ids.add(record2.id)) {
      throw new Error(`Analysis shard 'runtime' contains duplicate id '${record2.id}'.`);
    }
    for (const id of record2.evidence) {
      if (!evidenceIds.has(id)) {
        throw new Error(`Analysis record '${record2.id}' refers to missing evidence '${id}'.`);
      }
    }
    if (!Number.isSafeInteger(record2.count) || record2.count <= 0) {
      throw new Error(`Runtime record '${record2.id}' has an invalid observation count.`);
    }
    if (record2.kind === "runtime-coverage") {
      if (!Number.isSafeInteger(record2.start) || !Number.isSafeInteger(record2.end) || record2.start < 0 || record2.end <= record2.start) {
        throw new Error(`Runtime coverage '${record2.id}' has an invalid half-open range.`);
      }
    }
    if (record2.kind === "runtime-bus-access") {
      if (record2.architecture !== "snes.65816") {
        throw new Error("Bus facts require the SNES 65816 architecture.");
      }
      validateRuntimeBusFact(record2);
    }
    if (record2.kind === "runtime-graphics-access" && !isRuntimeGraphicsFact(record2)) {
      throw new Error("Invalid runtime graphics fact.");
    }
    if (record2.kind === "runtime-memory-access") {
      if (record2.actor !== void 0 && !["cpu", "dma", "hdma"].includes(record2.actor) || record2.channel !== void 0 && (!Number.isInteger(record2.channel) || record2.channel < 0 || record2.channel > 7 || !["dma", "hdma"].includes(record2.actor ?? "cpu"))) {
        throw new Error(`Runtime memory access '${record2.id}' has an invalid actor/channel.`);
      }
      if (!Number.isSafeInteger(record2.width) || record2.width <= 0) {
        throw new Error(`Runtime memory access '${record2.id}' has an invalid width.`);
      }
      if (record2.value !== void 0 && (!Number.isSafeInteger(record2.value) || record2.value < 0)) {
        throw new Error(`Runtime memory access '${record2.id}' has an invalid value.`);
      }
    }
    if (record2.kind === "runtime-execution") {
      if (record2.size !== void 0 && (!Number.isSafeInteger(record2.size) || record2.size <= 0)) {
        throw new Error(`Runtime execution '${record2.id}' has an invalid instruction size.`);
      }
      if (record2.opcode !== void 0 && (!Number.isInteger(record2.opcode) || record2.opcode < 0 || record2.opcode > 255)) {
        throw new Error(`Runtime execution '${record2.id}' has an invalid opcode.`);
      }
      if (record2.fileOffset !== void 0 && (!Number.isSafeInteger(record2.fileOffset) || record2.fileOffset < 0 || record2.fileOffset >= project.rom.contentSize)) {
        throw new Error(`Runtime execution '${record2.id}' has an invalid ROM file offset.`);
      }
    }
    if (record2.kind === "runtime-instruction") {
      validateRuntimeInstructionDetails([{ bytes: record2.bytes, state: record2.state }], 1);
    }
    if (record2.kind === "runtime-cpu-state") {
      for (const [name2, value] of Object.entries(record2.state)) {
        if (name2 === "" || !["string", "boolean", "number"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value)) {
          throw new Error(`Runtime CPU state '${record2.id}' has invalid field '${name2}'.`);
        }
      }
    }
    if ("addressSpace" in record2) {
      const space = addressSpaceById.get(record2.addressSpace);
      if (!space) {
        throw new Error(
          `Analysis record '${record2.id}' refers to unknown address space '${record2.addressSpace}'.`
        );
      }
      const addresses2 = record2.kind === "runtime-coverage" ? [record2.start, record2.end - 1] : [record2.address];
      if (addresses2.some(
        (address) => !Number.isSafeInteger(address) || address < 0 || address >= 2 ** space.addressBits
      )) {
        throw new Error(
          `Analysis record '${record2.id}' exceeds address space '${record2.addressSpace}'.`
        );
      }
    }
    let addresses = [];
    if (record2.kind === "runtime-memory-access") {
      addresses = [
        [record2.instructionAddressSpace, record2.instructionAddress],
        [record2.accessedAddressSpace, record2.accessedAddress]
      ];
    } else if (record2.kind === "runtime-bus-access" || record2.kind === "runtime-graphics-access") {
      addresses = [[record2.addressSpace, record2.pc]];
    } else if (record2.kind === "runtime-control-target") {
      addresses = [
        [record2.fromAddressSpace, record2.fromAddress],
        [record2.toAddressSpace, record2.toAddress]
      ];
    }
    for (const [spaceId, address] of addresses) {
      const addressSpace = addressSpaceById.get(spaceId);
      if (!addressSpace) {
        throw new Error(
          `Runtime record '${record2.id}' refers to unknown address space '${spaceId}'.`
        );
      }
      if (!Number.isSafeInteger(address) || address < 0 || address >= 2 ** addressSpace.addressBits) {
        throw new Error(`Runtime record '${record2.id}' exceeds address space '${spaceId}'.`);
      }
    }
    assertNoRomPayload(record2, `shards.runtime.${record2.id}`);
  };
  return Object.assign(validate, { close: () => ids?.close() });
};
var validateRuntimeRecords = (records, project, evidence) => {
  const validate = createRuntimeRecordValidator(project, evidence);
  try {
    for (const record2 of records) {
      validate(record2);
    }
  } finally {
    validate.close();
  }
};
var outsideSpace = (address, exclusiveMaximum) => !Number.isSafeInteger(address) || address < 0 || address >= exclusiveMaximum;
var validateLoadedShards = (shards, project, analysisScope = "complete") => {
  const { addressSpaces } = project;
  const evidenceIds = new Set(shards.evidence.map((record2) => record2.id));
  const shardKinds = [
    "analysis",
    "annotations",
    "labels",
    "comments",
    "regions",
    "evidence",
    "imports"
  ];
  for (const kind of shardKinds) {
    const ids = /* @__PURE__ */ new Set();
    for (const record2 of shards[kind]) {
      if (typeof record2.id !== "string" || record2.id === "") {
        throw new Error(`Analysis shard '${kind}' contains a record without an id.`);
      }
      if (ids.has(record2.id)) {
        throw new Error(`Analysis shard '${kind}' contains duplicate id '${record2.id}'.`);
      }
      ids.add(record2.id);
      if (!("evidence" in record2)) {
        continue;
      }
      for (const evidence of record2.evidence) {
        if (!evidenceIds.has(evidence)) {
          throw new Error(
            `Analysis record '${record2.id}' refers to missing evidence '${evidence}'.`
          );
        }
      }
    }
  }
  for (const evidence of shards.evidence) {
    if (!evidence.artifact) {
      continue;
    }
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
    if (!annotation.asset) {
      continue;
    }
    if (!["asset", "compressed", "graphics", "music", "text"].includes(annotation.classification)) {
      throw new Error(
        `Analysis annotation '${annotation.id}' cannot attach an asset codec to '${annotation.classification}'.`
      );
    }
    assertCodecReference(annotation.asset, `Analysis annotation '${annotation.id}' asset codec`);
    const compression = annotation.asset.compression;
    if (!compression) {
      continue;
    }
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
    if (conflict.kind !== "conflict" || conflict.end === void 0) {
      continue;
    }
    if (!Number.isSafeInteger(conflict.end) || conflict.end <= conflict.address) {
      throw new Error(`Analysis conflict '${conflict.id}' has an invalid half-open range.`);
    }
  }
  validateAnalysisOwnership(shards.analysis, analysisScope);
  const regionsById = new Map(shards.regions.map((region) => [region.id, region]));
  for (const region of shards.regions) {
    if (!region.parentRegion) {
      continue;
    }
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
      if (!next) {
        break;
      }
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
    if (label.suppressed !== void 0 && typeof label.suppressed !== "boolean") {
      throw new Error(`Analysis label '${label.id}' has an invalid suppression flag.`);
    }
    if (label.sourceName !== void 0 && (typeof label.sourceName !== "string" || !/^[A-Z_a-z]\w*$/.test(label.sourceName))) {
      throw new Error(`Analysis label '${label.id}' has an invalid source name.`);
    }
    if (label.inlineComment !== void 0 && (typeof label.inlineComment !== "string" || /[\n\r\u2028\u2029]/.test(label.inlineComment))) {
      throw new Error(`Analysis label '${label.id}' requires a single-line inline comment.`);
    }
    if (label.analysisEntryPoint !== void 0 && typeof label.analysisEntryPoint !== "boolean") {
      throw new Error(`Analysis label '${label.id}' has an invalid analysisEntryPoint.`);
    }
  }
  for (const comment of shards.comments) {
    if (comment.placement !== void 0 && !["before", "inline-instruction"].includes(comment.placement)) {
      throw new Error(`Analysis comment '${comment.id}' has an invalid placement.`);
    }
    if (comment.placement === "inline-instruction" && (typeof comment.text !== "string" || /[\n\r\u2028\u2029]/.test(comment.text))) {
      throw new Error(`Analysis comment '${comment.id}' requires a single-line inline comment.`);
    }
  }
  const addressSpaceById = new Map(
    addressSpaces.map((addressSpace) => [addressSpace.id, addressSpace])
  );
  for (const records of [
    shards.annotations,
    shards.labels,
    shards.comments,
    shards.regions,
    shards.analysis
  ]) {
    for (const record2 of records) {
      if (!("addressSpace" in record2)) {
        continue;
      }
      const addressSpace = addressSpaceById.get(record2.addressSpace);
      if (!addressSpace) {
        throw new Error(
          `Analysis record '${record2.id}' refers to unknown address space '${record2.addressSpace}'.`
        );
      }
      if ("mapping" in record2 && record2.mapping !== void 0) {
        if (!isResearchMapping(record2.mapping) || record2.mapping.fileOffset !== void 0 && record2.mapping.fileOffset + ("start" in record2 ? record2.end - record2.start : 1) > project.rom.contentSize) {
          throw new Error(`Invalid research mapping for '${record2.id}'.`);
        }
      }
      const maximum = 2 ** addressSpace.addressBits;
      let invalid = false;
      if ("start" in record2) {
        invalid = outsideSpace(record2.start, maximum) || outsideSpace(record2.end - 1, maximum);
      } else if ("address" in record2) {
        invalid = outsideSpace(record2.address, maximum);
        if ("kind" in record2 && record2.kind === "conflict" && record2.end !== void 0) {
          invalid ||= outsideSpace(record2.end - 1, maximum);
        }
      } else {
        if ("fromAddress" in record2) {
          invalid = outsideSpace(record2.fromAddress, maximum);
        }
        if ("toAddress" in record2 && record2.toAddress !== void 0) {
          invalid ||= outsideSpace(record2.toAddress, maximum);
        }
        if ("targets" in record2) {
          for (const target of record2.targets) {
            invalid ||= outsideSpace(target, maximum);
          }
        }
      }
      if (invalid) {
        throw new Error(
          `Analysis record '${record2.id}' exceeds address space '${record2.addressSpace}'.`
        );
      }
    }
  }
  validateRuntimeRecords(shards.runtime, project, shards.evidence);
  assertNoRomPayload({ ...shards, runtime: [] }, "shards");
};

// packages/disassembler/src/model/record-shape.ts
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isFiniteNumberArray(value) {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
function isJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (isFiniteNumber(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord4(value) && Object.values(value).every(isJsonValue);
}
function allowsString(value) {
  return value === void 0 || typeof value === "string";
}
function allowsFinite(value) {
  return value === void 0 || isFiniteNumber(value);
}
function allowsBoolean(value) {
  return value === void 0 || typeof value === "boolean";
}
function isNumberRecord(value) {
  return isRecord4(value) && Object.values(value).every(isFiniteNumber);
}
function isAttributeRecord(value) {
  return isRecord4(value) && Object.values(value).every(
    (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry)
  );
}
function isRecordArray(value) {
  return Array.isArray(value) && value.every(isRecord4);
}
var CLASSIFICATIONS = [
  "unreached",
  "opcode",
  "operand",
  "data8",
  "data16",
  "data24",
  "data32",
  "pointer16",
  "pointer24",
  "pointer32",
  "graphics",
  "music",
  "compressed",
  "asset",
  "empty",
  "text"
];
function isClassification(value) {
  return CLASSIFICATIONS.some((candidate) => candidate === value);
}
function isAnnotationState(value) {
  if (value === void 0) {
    return true;
  }
  if (!isRecord4(value)) {
    return false;
  }
  for (const key3 of Object.keys(value)) {
    const entry = value[key3];
    if (key3 === "e" || key3 === "m" || key3 === "x" || key3 === "carry") {
      if (typeof entry !== "boolean") {
        return false;
      }
    } else if (key3 === "programBank" || key3 === "dataBank" || key3 === "directPage" || key3 === "stackPointer") {
      if (!isFiniteNumber(entry)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}
function isPoints(value) {
  return value === void 0 || Array.isArray(value) && value.every(
    (point) => point === "in" || point === "out" || point === "end" || point === "read"
  );
}
function isCodecFields(value) {
  if (typeof value.codecId !== "string" || typeof value.codecVersion !== "string") {
    return false;
  }
  const provider = value.provider;
  if (provider !== void 0) {
    if (!isRecord4(provider) || typeof provider.pluginId !== "string" || typeof provider.pluginVersion !== "string") {
      return false;
    }
  }
  return value.options === void 0 || isJsonValue(value.options);
}
function isAsset(value) {
  if (!isRecord4(value) || !isCodecFields(value)) {
    return false;
  }
  const compression = value.compression;
  if (compression === void 0) {
    return true;
  }
  return isRecord4(compression) && isCodecFields(compression) && allowsFinite(compression.maximumSize) && allowsFinite(compression.bankStart) && allowsFinite(compression.bankEnd) && allowsFinite(compression.fillByte);
}
function hasIdentity(value) {
  return typeof value.id === "string" && isStringArray(value.evidence);
}
function isProjectLabel(value) {
  return isRecord4(value) && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.name === "string" && allowsString(value.comment) && allowsString(value.sourceName) && (value.aliases === void 0 || isStringArray(value.aliases)) && allowsString(value.inlineComment) && allowsBoolean(value.analysisEntryPoint) && allowsBoolean(value.suppressed) && allowsString(value.author) && allowsString(value.confidence);
}
function isProjectComment(value) {
  return isRecord4(value) && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.text === "string" && (value.placement === void 0 || value.placement === "before" || value.placement === "inline-instruction");
}
function isProjectRegion(value) {
  return isRecord4(value) && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && isFiniteNumber(value.start) && isFiniteNumber(value.end) && typeof value.name === "string" && allowsString(value.parentRegion) && allowsString(value.context) && allowsFinite(value.priority) && (value.attributes === void 0 || isAttributeRecord(value.attributes));
}
function isIntervalAnnotation(value) {
  return isRecord4(value) && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && isFiniteNumber(value.start) && isFiniteNumber(value.end) && isClassification(value.classification) && typeof value.architecture === "string" && isAnnotationState(value.state) && isPoints(value.points) && (value.asset === void 0 || isAsset(value.asset));
}
function isArtifact(value) {
  if (value === void 0) {
    return true;
  }
  return isRecord4(value) && typeof value.format === "string" && typeof value.sha256 === "string" && typeof value.romContentSha256 === "string" && allowsString(value.formatVersion) && allowsString(value.mapper);
}
function isEvidenceRecord(value) {
  return isRecord4(value) && typeof value.id === "string" && (value.source === "manual" || value.source === "import" || value.source === "detector" || value.source === "static" || value.source === "runtime") && typeof value.sourceId === "string" && (value.confidence === "certain" || value.confidence === "high" || value.confidence === "medium" || value.confidence === "low" || value.confidence === "unknown") && allowsString(value.detail) && isArtifact(value.artifact);
}
function isLossItem(value) {
  return isRecord4(value) && typeof value.field === "string" && isFiniteNumber(value.count) && typeof value.reason === "string";
}
function isImportReport(value) {
  return isRecord4(value) && typeof value.id === "string" && typeof value.format === "string" && typeof value.sourceName === "string" && typeof value.sourceSha256 === "string" && allowsString(value.sourceVersion) && allowsString(value.indexProfile) && isNumberRecord(value.imported) && Array.isArray(value.unsupported) && value.unsupported.every(isLossItem) && isStringArray(value.warnings);
}
function isControlFlowNode(value) {
  return isRecord4(value) && value.kind === "cfg-node" && hasIdentity(value) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && allowsFinite(value.fileOffset) && (value.bytes === void 0 || isFiniteNumberArray(value.bytes)) && isFiniteNumber(value.size) && isFiniteNumber(value.opcode) && typeof value.specificationId === "string" && typeof value.mnemonic === "string" && typeof value.mode === "string" && isFiniteNumberArray(value.context) && isRecord4(value.incomingState) && isRecord4(value.outgoingState) && isRecordArray(value.effectiveAddresses) && typeof value.entryPoint === "string" && allowsString(value.functionEntry) && allowsString(value.evidencePredecessor) && isStringArray(value.evidencePath);
}
function isControlFlowEdge(value) {
  return isRecord4(value) && value.kind === "cfg-edge" && hasIdentity(value) && typeof value.addressSpace === "string" && typeof value.from === "string" && isFiniteNumber(value.fromAddress) && allowsString(value.to) && allowsFinite(value.toAddress) && typeof value.edgeKind === "string" && typeof value.indirect === "boolean" && allowsString(value.override) && allowsString(value.explanation);
}
function isFunctionRecord(value) {
  return isRecord4(value) && value.kind === "function" && hasIdentity(value) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.source === "string" && isStringArray(value.evidencePath);
}
function isConflictRecord(value) {
  return isRecord4(value) && value.kind === "conflict" && hasIdentity(value) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && allowsFinite(value.end) && typeof value.conflictKind === "string" && typeof value.message === "string" && isStringArray(value.nodes);
}
function isUnresolvedRecord(value) {
  return isRecord4(value) && value.kind === "unresolved" && hasIdentity(value) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.flowKind === "string" && typeof value.indirect === "boolean" && typeof value.reason === "string";
}
function isSummaryRecord(value) {
  return isRecord4(value) && value.kind === "summary" && hasIdentity(value) && typeof value.architecture === "string" && (value.status === "complete" || value.status === "incomplete") && isNumberRecord(value.coverage) && isFiniteNumber(value.processedWorkItems) && isRecordArray(value.incompleteReasons);
}
function isTargetOverride(value) {
  return isRecord4(value) && value.kind === "target-override" && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && isFiniteNumberArray(value.targets);
}
function isTargetSet(value) {
  return isRecord4(value) && value.kind === "target-set" && hasIdentity(value) && (value.mapping === void 0 || isResearchMapping(value.mapping)) && typeof value.addressSpace === "string" && typeof value.name === "string" && isFiniteNumberArray(value.targets);
}
function isAnalysisRecord(value) {
  if (!isRecord4(value)) {
    return false;
  }
  switch (value.kind) {
    case "cfg-node":
      return isControlFlowNode(value);
    case "cfg-edge":
      return isControlFlowEdge(value);
    case "function":
      return isFunctionRecord(value);
    case "conflict":
      return isConflictRecord(value);
    case "unresolved":
      return isUnresolvedRecord(value);
    case "summary":
      return isSummaryRecord(value);
    case "target-override":
      return isTargetOverride(value);
    case "target-set":
      return isTargetSet(value);
    default:
      return false;
  }
}
function reject(kind) {
  throw new Error(`Invalid stored ${kind} record.`);
}
function requireProjectLabel(value) {
  if (!isProjectLabel(value)) {
    reject("label");
  }
  return value;
}
function requireProjectComment(value) {
  if (!isProjectComment(value)) {
    reject("comment");
  }
  return value;
}
function requireProjectRegion(value) {
  if (!isProjectRegion(value)) {
    reject("region");
  }
  return value;
}
function requireIntervalAnnotation(value) {
  if (!isIntervalAnnotation(value)) {
    reject("annotation");
  }
  return value;
}
function requireEvidenceRecord(value) {
  if (!isEvidenceRecord(value)) {
    reject("evidence");
  }
  return value;
}
function requireImportReport(value) {
  if (!isImportReport(value)) {
    reject("import");
  }
  return value;
}
function requireAnalysisRecord(value) {
  if (!isAnalysisRecord(value)) {
    reject("analysis");
  }
  return value;
}
function requireMetadataRecord(kind, value) {
  switch (kind) {
    case "labels":
      return requireProjectLabel(value);
    case "comments":
      return requireProjectComment(value);
    case "regions":
      return requireProjectRegion(value);
    case "annotations":
      return requireIntervalAnnotation(value);
    case "analysis":
      return requireAnalysisRecord(value);
    case "evidence":
      return requireEvidenceRecord(value);
    case "imports":
      return requireImportReport(value);
    default:
      return reject(kind);
  }
}

// packages/disassembler/src/research-inputs/inputs.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
init_canonical_json();

// packages/disassembler/src/internal/source-inputs.ts
var import_node_crypto = require("node:crypto");
var import_node_path2 = __toESM(require("node:path"), 1);
var sourceContentHash = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
function assertSourcePath(relative) {
  if (!relative || relative.includes("\0") || relative.includes("\\") || import_node_path2.default.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    throw new Error(`Invalid source project path: ${relative}`);
  }
}

// packages/disassembler/src/model/metadata-validation.ts
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringList(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isInteger4(value) {
  return typeof value === "number" && Number.isInteger(value);
}
function isSafeInteger3(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isStateRecord(value) {
  return typeof value === "object" && value !== null;
}
function stateEntries(state) {
  if (typeof state === "string") {
    const entries2 = [];
    for (let index = 0; index < state.length; index += 1) {
      entries2.push([String(index), state[index]]);
    }
    return entries2;
  }
  if (!isStateRecord(state)) {
    return [];
  }
  const entries = [];
  for (const field of Object.keys(state)) {
    entries.push([field, state[field]]);
  }
  return entries;
}
var CLASSIFICATIONS2 = [
  "unreached",
  "opcode",
  "operand",
  "data8",
  "data16",
  "data24",
  "data32",
  "pointer16",
  "pointer24",
  "pointer32",
  "graphics",
  "music",
  "compressed",
  "asset",
  "empty",
  "text"
];
var validateEditableMetadataRecord = (shard, record2) => {
  if (!isRecord5(record2) || typeof record2.id !== "string" || !/^\w[\w./:-]*$/.test(record2.id) || !isStringList(record2.evidence)) {
    throw new Error("Metadata needs a stable record ID and evidence list.");
  }
  if (record2.mapping !== void 0 && !isResearchMapping(record2.mapping)) {
    throw new Error("Invalid research mapping selector.");
  }
  if (record2.kind === "target-set" && record2.mapping && "fileOffset" in record2.mapping) {
    throw new Error(
      "Target sets use mapper state; a single physical anchor cannot select multiple targets."
    );
  }
  const address = record2.address;
  if ("address" in record2 && !(isSafeInteger3(address) && address >= 0)) {
    throw new Error("Metadata needs a nonnegative integer address.");
  }
  if (typeof record2.addressSpace !== "string") {
    throw new Error("Metadata needs a named address space.");
  }
  if (shard === "labels") {
    const name2 = record2.name;
    if (typeof name2 !== "string" || name2 === "" || !("address" in record2) || "kind" in record2) {
      throw new Error("Invalid label metadata.");
    }
    const sourceName = record2.sourceName;
    if (sourceName !== void 0) {
      if (typeof sourceName !== "string") {
        throw new Error(
          "Use a global label name containing letters, digits, and underscores, starting with a letter or underscore."
        );
      }
      validateSourceLabelName(sourceName);
    }
    if (record2.suppressed !== void 0 && typeof record2.suppressed !== "boolean") {
      throw new Error("Invalid label suppression flag.");
    }
    for (const value of [record2.comment, record2.inlineComment]) {
      if (value !== void 0 && (typeof value !== "string" || value.includes("\0"))) {
        throw new Error("Invalid label comment.");
      }
    }
  } else if (shard === "comments") {
    const text = record2.text;
    if (typeof text !== "string" || !text.trim() || text.includes("\0") || !("address" in record2) || "kind" in record2) {
      throw new Error("A standalone comment needs nonempty text.");
    }
  } else if (shard === "annotations") {
    const classification = record2.classification;
    const architecture = record2.architecture;
    if (typeof classification !== "string" || !CLASSIFICATIONS2.some((candidate) => candidate === classification) || typeof architecture !== "string" || architecture === "") {
      throw new Error("Invalid classification metadata.");
    }
    const start = record2.start;
    const end = record2.end;
    if (!(isSafeInteger3(start) && isSafeInteger3(end) && start >= 0 && end > start)) {
      throw new Error("Classification bounds must describe a nonempty half-open interval.");
    }
    const state = record2.state ?? {};
    for (const [field, value] of stateEntries(state)) {
      if (field === "e" || field === "m" || field === "x" || field === "carry") {
        if (typeof value !== "boolean") {
          throw new Error(`State ${field} must be true or false; omit it to clear the hint.`);
        }
      } else {
        const maximum = field === "programBank" || field === "dataBank" ? 255 : 65535;
        if (field !== "programBank" && field !== "dataBank" && field !== "directPage" && field !== "stackPointer" || !(isInteger4(value) && value >= 0 && value <= maximum)) {
          throw new Error(`Invalid state field '${field}'.`);
        }
      }
    }
    const points = record2.points;
    if (Array.isArray(points) && points.some(
      (point) => point !== "in" && point !== "out" && point !== "end" && point !== "read" || typeof point !== "string"
    )) {
      throw new Error("Invalid entry-point metadata.");
    }
  } else {
    const kind = record2.kind;
    const targets = record2.targets;
    if (kind !== "target-override" && kind !== "target-set" || !Array.isArray(targets) || targets.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error("Only target overrides and target sets are editable analysis records.");
    }
    if (kind === "target-set" && (typeof record2.name !== "string" || !record2.name.trim())) {
      throw new Error("A target set needs a name.");
    }
    if (kind === "target-override" && !Number.isSafeInteger(record2.address)) {
      throw new Error("A target override needs an instruction anchor.");
    }
  }
};

// packages/disassembler/src/research-inputs/inputs.ts
var isArray = (value) => Array.isArray(value);
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray2(value) {
  return Array.isArray(value);
}
function isResearchCollection(value) {
  return RESEARCH_COLLECTIONS.some((collection) => collection === value);
}
function isSafeInteger4(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isConfidence(value) {
  return value === "certain" || value === "high" || value === "medium" || value === "low" || value === "unknown";
}
var RESEARCH_COLLECTIONS = [
  "labels",
  "comments",
  "annotations",
  "regions",
  "analysis",
  "evidence"
];
var RESEARCH_INPUT_LIMIT_NAMES = [
  "researchDocumentBytes",
  "researchBytes",
  "researchFiles"
];
function validateResearchSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.project !== "string" || !/^[\w.-]+$/.test(snapshot.project) || typeof snapshot.romSha256 !== "string" || !/^[\da-f]{64}$/.test(snapshot.romSha256) || !isArray(snapshot.decisions)) {
    throw new Error("Invalid research snapshot identity.");
  }
  const keys = /* @__PURE__ */ new Set();
  for (const decision of snapshot.decisions) {
    validateResearchDecision(decision);
    const key3 = `${decision.collection}:${decision.id}`;
    if (keys.has(key3)) {
      throw new Error(`Duplicate research decision: ${key3}`);
    }
    keys.add(key3);
  }
  const decisions = [...snapshot.decisions].toSorted(compareDecisions);
  if (snapshot.hash !== sourceContentHash(
    canonicalJson({ project: snapshot.project, romSha256: snapshot.romSha256, decisions })
  )) {
    throw new Error("Research snapshot content differs from its identity.");
  }
}
var compareDecisions = (a, b) => Buffer.compare(Buffer.from(`${a.collection}:${a.id}`), Buffer.from(`${b.collection}:${b.id}`));
function validateResearchDecision(decision) {
  if (!isRecord6(decision)) {
    throw new Error("Research decisions require a known collection and stable ID.");
  }
  const collection = decision.collection;
  const id = decision.id;
  if (!isResearchCollection(collection) || typeof id !== "string" || !/^\w[\w./:-]*$/.test(id)) {
    throw new Error("Research decisions require a known collection and stable ID.");
  }
  const record2 = decision.value;
  if (record2 === null) {
    return;
  }
  if (!isRecord6(record2) || record2.id !== id) {
    throw new Error(`Research record identity mismatch: ${id}`);
  }
  if (collection === "evidence") {
    const sourceId = record2.sourceId;
    const detail = record2.detail;
    if (record2.source !== "manual" || typeof sourceId !== "string" || sourceId === "" || !isConfidence(record2.confidence) || detail !== void 0 && typeof detail !== "string") {
      throw new Error("Research files may author only valid manual evidence.");
    }
    return;
  }
  const evidence = record2.evidence;
  if (!isUnknownArray2(evidence) || evidence.some((entry) => typeof entry !== "string")) {
    throw new Error(`Research record ${id} needs an evidence list.`);
  }
  if (record2.mapping !== void 0 && !isResearchMapping(record2.mapping)) {
    throw new Error("Invalid research mapping selector.");
  }
  if (collection === "regions") {
    const name2 = record2.name;
    const start = record2.start;
    const end = record2.end;
    if (typeof name2 !== "string" || name2 === "" || !(isSafeInteger4(start) && isSafeInteger4(end) && start >= 0 && end > start)) {
      throw new Error(`Invalid research region: ${id}`);
    }
  } else {
    validateEditableMetadataRecord(collection, record2);
  }
  if (collection === "labels" && record2.aliases !== void 0) {
    const aliases = record2.aliases;
    if (!isUnknownArray2(aliases)) {
      throw new Error("Symbol aliases must be an array.");
    }
    for (const alias of aliases) {
      if (typeof alias !== "string") {
        throw new Error(
          "Use a global label name containing letters, digits, and underscores, starting with a letter or underscore."
        );
      }
      validateSourceLabelName(alias);
    }
    if (new Set(aliases).size !== aliases.length) {
      throw new Error("Symbol aliases must be unique.");
    }
  }
}
function parseResearchDocument(value) {
  if (!isRecord6(value)) {
    throw new Error("Invalid research document header.");
  }
  const project = value.project;
  const romSha256 = value.romSha256;
  const decisions = value.decisions;
  if (value.format !== "uttori-research" || value.version !== 1 || typeof project !== "string" || !/^[\w.-]+$/.test(project) || typeof romSha256 !== "string" || !/^[\da-f]{64}$/.test(romSha256) || !isUnknownArray2(decisions) || Object.keys(value).some(
    (key3) => !["format", "version", "project", "romSha256", "decisions"].includes(key3)
  )) {
    throw new Error("Invalid research document header.");
  }
  const parsed = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, decision] of decisions.entries()) {
    try {
      validateResearchDecision(decision);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`decisions[${index}]: ${detail}`, { cause: error });
    }
    const key3 = `${decision.collection}:${decision.id}`;
    if (seen.has(key3)) {
      throw new Error(`Duplicate research decision: ${key3}`);
    }
    seen.add(key3);
    parsed.push(decision);
  }
  return { format: "uttori-research", version: 1, project, romSha256, decisions: parsed };
}
function researchPath(root, relative) {
  assertSourcePath(relative);
  let current = root;
  for (const part of relative.split("/")) {
    current = import_node_path3.default.join(current, part);
    if (import_node_fs2.default.existsSync(current) && import_node_fs2.default.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Research inputs cannot follow symlinks: ${relative}`);
    }
  }
  return current;
}
function readResearchInputs(root, roots, identity, overlays = /* @__PURE__ */ new Map(), limits = {}) {
  for (const name2 of RESEARCH_INPUT_LIMIT_NAMES) {
    const limit = limits[name2];
    if (limit !== void 0 && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new Error(
        `Invalid limits.${name2}: use a positive safe integer in .uttori/project.json.`
      );
    }
  }
  const names = /* @__PURE__ */ new Set();
  const files = [];
  let totalBytes = 0;
  const checkLimit = (name2, actual, file, unit) => {
    const limit = limits[name2];
    if (limit !== void 0 && actual > limit) {
      throw new Error(
        `Research input ${file}: ${actual.toLocaleString("en-US")} ${unit} exceeds limits.${name2} (${limit.toLocaleString("en-US")} ${unit}). Increase or remove limits.${name2} in .uttori/project.json, or reduce the selected research inputs.`
      );
    }
  };
  const visit = (initial) => {
    const pending = [initial];
    while (pending.length) {
      const relative = pending.pop();
      const file = researchPath(root, relative);
      const overlay = overlays.get(relative);
      const stat = import_node_fs2.default.existsSync(file) ? import_node_fs2.default.lstatSync(file) : void 0;
      if (!stat && overlay === void 0) {
        throw new Error(
          `Research input does not exist: ${file}. Restore the selected path or correct researchRoots in .uttori/project.json.`
        );
      }
      if (stat?.isDirectory()) {
        for (const entry of import_node_fs2.default.readdirSync(file).toSorted().toReversed()) {
          pending.push(`${relative}/${entry}`);
        }
        continue;
      }
      if (stat && !stat.isFile()) {
        throw new Error(
          `Research input is not a regular file: ${file}. Select JSON files or directories in researchRoots.`
        );
      }
      if (!relative.endsWith(".json")) {
        continue;
      }
      const name2 = relative.normalize("NFC").toLowerCase();
      if (names.has(name2)) {
        throw new Error(
          `Repeated or ambiguous research input: ${file}. Remove overlapping researchRoots or conflicting filenames.`
        );
      }
      names.add(name2);
      const size = overlay === void 0 ? stat.size : Buffer.byteLength(overlay);
      totalBytes += size;
      checkLimit("researchDocumentBytes", size, file, "bytes in this document");
      checkLimit("researchBytes", totalBytes, file, "bytes across selected documents");
      checkLimit("researchFiles", names.size, file, "selected JSON files");
      let bytes;
      let document;
      try {
        bytes = overlay === void 0 ? import_node_fs2.default.readFileSync(file) : Buffer.from(overlay);
        document = parseResearchDocument(JSON.parse(bytes.toString("utf8")));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid research input ${file}: ${detail}`, { cause: error });
      }
      if (document.project !== identity.project || document.romSha256 !== identity.romSha256) {
        throw new Error(
          `Research input belongs to another project or ROM: ${file}. Expected project ${identity.project} and ROM ${identity.romSha256}; found project ${document.project} and ROM ${document.romSha256}.`
        );
      }
      files.push({ path: relative, sha256: sourceContentHash(bytes), document });
    }
  };
  for (const relative of roots) {
    visit(relative);
  }
  for (const relative of overlays.keys()) {
    if (roots.some((name2) => relative === name2 || relative.startsWith(`${name2}/`)) && !names.has(relative.normalize("NFC").toLowerCase())) {
      visit(relative);
    }
  }
  files.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const decisions = files.flatMap((file) => file.document.decisions);
  const ids = /* @__PURE__ */ new Map();
  for (const file of files) {
    for (const decision of file.document.decisions) {
      const key3 = `${decision.collection}:${decision.id}`;
      const previous = ids.get(key3);
      if (previous !== void 0) {
        throw new Error(
          `Research decision has more than one authoring location: ${key3} in ${previous} and ${file.path}. Keep the decision in one document.`
        );
      }
      ids.set(key3, file.path);
    }
  }
  decisions.sort(compareDecisions);
  const selected = { project: identity.project, romSha256: identity.romSha256 };
  const hash = sourceContentHash(canonicalJson({ ...selected, decisions }));
  return { ...selected, files, decisions, hash };
}

// packages/disassembler/src/storage/sqlite-payload.ts
var import_node_util = require("node:util");
var import_node_zlib2 = require("node:zlib");

// packages/disassembler/src/storage/sqlite-runtime-payload.ts
var import_node_zlib = require("node:zlib");
var MAGIC = Buffer.from([85, 65, 82, 1]);
var FIELDS = [
  ["a", 2],
  ["d", 2],
  ["db", 1],
  ["e", 1],
  ["p", 1],
  ["pb", 1],
  ["pc", 2],
  ["s", 2],
  ["x", 2],
  ["y", 2]
];
var FIELD_NAMES = new Set(FIELDS.map(([key3]) => key3));
var HEADER_BYTES = 7;
var CHECKSUM_BYTES = 4;
var encodePackedRuntimePayload = (record2) => {
  if (Object.keys(record2.state).some((key3) => !FIELD_NAMES.has(key3))) {
    return void 0;
  }
  const bytes = record2.bytes;
  if (bytes !== void 0) {
    if (bytes.length < 1 || bytes.length > 4) {
      return void 0;
    }
    for (const value of bytes) {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        return void 0;
      }
    }
  }
  let mask = 0;
  let size = HEADER_BYTES + (bytes?.length ?? 0) + CHECKSUM_BYTES;
  for (const [index, [key3, width]] of FIELDS.entries()) {
    if (!Object.hasOwn(record2.state, key3)) {
      continue;
    }
    const value = record2.state[key3];
    const max = key3 === "e" ? 1 : 2 ** (width * 8) - 1;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
      return void 0;
    }
    mask |= 1 << index;
    size += width;
  }
  const encoded = Buffer.allocUnsafe(size);
  MAGIC.copy(encoded);
  encoded.writeUInt16LE(mask, 4);
  encoded[6] = bytes?.length ?? 0;
  let offset = HEADER_BYTES;
  for (const byte of bytes ?? []) {
    encoded[offset++] = byte;
  }
  for (const [index, [key3, width]] of FIELDS.entries()) {
    if (mask & 1 << index) {
      const field = record2.state[key3];
      if (typeof field !== "number") {
        return void 0;
      }
      encoded.writeUIntLE(field, offset, width);
      offset += width;
    }
  }
  encoded.writeUInt32LE((0, import_node_zlib.crc32)(encoded.subarray(0, offset)), offset);
  return encoded;
};
var isPackedRuntimePayload = (bytes) => bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] && bytes[2] === MAGIC[2];
var decodePackedRuntimePayload = (bytes) => {
  const encoded = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (encoded.length < HEADER_BYTES + CHECKSUM_BYTES || !encoded.subarray(0, 4).equals(MAGIC)) {
    throw new Error("Unsupported or truncated packed runtime payload.");
  }
  const mask = encoded.readUInt16LE(4);
  const byteCount = encoded[6];
  let expected = HEADER_BYTES + byteCount + CHECKSUM_BYTES;
  for (const [index, [, width]] of FIELDS.entries()) {
    if (mask & 1 << index) {
      expected += width;
    }
  }
  if (mask >= 1 << FIELDS.length || byteCount > 4 || encoded.length !== expected) {
    throw new Error("Invalid packed runtime payload layout.");
  }
  const end = expected - CHECKSUM_BYTES;
  if ((0, import_node_zlib.crc32)(encoded.subarray(0, end)) !== encoded.readUInt32LE(end)) {
    throw new Error("Corrupt packed runtime payload checksum.");
  }
  const state = {};
  let offset = HEADER_BYTES + byteCount;
  for (const [index, [key3, width]] of FIELDS.entries()) {
    if (mask & 1 << index) {
      const value = encoded.readUIntLE(offset, width);
      if (key3 === "e" && value > 1) {
        throw new Error("Invalid packed emulation register.");
      }
      state[key3] = value;
      offset += width;
    }
  }
  if (byteCount === 0) {
    return { state };
  }
  return { bytes: [...encoded.subarray(HEADER_BYTES, HEADER_BYTES + byteCount)], state };
};

// packages/disassembler/src/storage/sqlite-payload.ts
var MAX_SQLITE_PAYLOAD_BYTES = 16 * 1024 * 1024;
var HEADER = Buffer.from([85, 65, 80, 1]);
var HEADER_BYTES2 = 8;
var utf8 = new import_node_util.TextDecoder("utf-8", { fatal: true });
var encodeSqlitePayload = (json) => {
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error(`SQLite record exceeds the ${MAX_SQLITE_PAYLOAD_BYTES}-byte payload limit.`);
  }
  if (bytes < 1024) {
    return json;
  }
  const small = bytes < 16 * 1024;
  const compressed = (0, import_node_zlib2.deflateSync)(json, {
    level: 1,
    windowBits: small ? 12 : 15,
    memLevel: small ? 3 : 8,
    chunkSize: Math.min(bytes, 16 * 1024)
  });
  if (compressed.length + HEADER_BYTES2 > bytes - Math.max(32, Math.ceil(bytes / 8))) {
    return json;
  }
  const result = Buffer.allocUnsafe(HEADER_BYTES2 + compressed.length);
  HEADER.copy(result);
  result.writeUInt32LE(bytes, 4);
  compressed.copy(result, HEADER_BYTES2);
  return result;
};
var decodeSqlitePayload = (value) => {
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > MAX_SQLITE_PAYLOAD_BYTES) {
      throw new Error("SQLite text payload exceeds the decoded size limit.");
    }
    return value;
  }
  if (!import_node_util.types.isUint8Array(value)) {
    throw new Error("Invalid SQLite payload representation.");
  }
  const encoded = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (isPackedRuntimePayload(encoded)) {
    return JSON.stringify(decodePackedRuntimePayload(encoded));
  }
  if (encoded.length <= HEADER_BYTES2 || !encoded.subarray(0, 4).equals(HEADER)) {
    throw new Error("Unsupported or truncated SQLite payload codec.");
  }
  const bytes = encoded.readUInt32LE(4);
  if (bytes === 0 || bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error("SQLite compressed payload exceeds the decoded size limit.");
  }
  try {
    const decoded = (0, import_node_zlib2.inflateSync)(encoded.subarray(HEADER_BYTES2), {
      maxOutputLength: bytes,
      chunkSize: Math.max(64, Math.min(bytes, 16 * 1024))
    });
    if (decoded.length !== bytes) {
      throw new Error("Decoded payload length does not match its header.");
    }
    return utf8.decode(decoded);
  } catch (cause) {
    throw new Error("Corrupt SQLite compressed payload.", { cause });
  }
};
var parseSqlitePayload = (value) => {
  if (import_node_util.types.isUint8Array(value) && isPackedRuntimePayload(value)) {
    return decodePackedRuntimePayload(value);
  }
  const parsed = JSON.parse(decodeSqlitePayload(value));
  return parsed;
};
var sqliteRuntimeIdentity = (id) => {
  const split = id.lastIndexOf(":") + 1;
  const suffix = id.slice(split);
  return {
    prefix: id.slice(0, split),
    suffix: /^[\da-f]{64}$/.test(suffix) ? Buffer.from(suffix, "hex") : suffix
  };
};
var decodeSqliteRuntimeIdentity = (prefix, suffix) => {
  if (typeof prefix !== "string") {
    throw new Error("Invalid SQLite runtime ID prefix.");
  }
  if (typeof suffix === "string") {
    return prefix + suffix;
  }
  if (!import_node_util.types.isUint8Array(suffix) || suffix.length !== 32) {
    throw new Error("Invalid SQLite runtime ID suffix.");
  }
  return prefix + Buffer.from(suffix).toString("hex");
};

// packages/disassembler/src/storage/sqlite-records.ts
init_canonical_json();
var compareRuntimeRecordIds = (left, right) => {
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
};
var runtimeColumns = (record2) => {
  switch (record2.kind) {
    case "runtime-execution":
      return {
        addressSpace: record2.addressSpace,
        address: record2.address,
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
        payload: canonicalJson({
          ...record2.fileOffset === void 0 ? {} : { fileOffset: record2.fileOffset },
          ...record2.size === void 0 ? {} : { size: record2.size },
          ...record2.opcode === void 0 ? {} : { opcode: record2.opcode }
        })
      };
    case "runtime-instruction":
      return {
        addressSpace: record2.addressSpace,
        address: record2.address,
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
        payload: canonicalJson({ bytes: record2.bytes, state: record2.state })
      };
    case "runtime-graphics-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: record2.context === "instruction" ? record2.addressSpace : null,
        instructionAddress: record2.context === "instruction" ? record2.pc : null,
        accessedAddressSpace: record2.addressSpace,
        accessedAddress: record2.address,
        coverage: null,
        payload: canonicalJson({
          pc: record2.pc,
          actor: record2.actor,
          context: record2.context,
          direction: record2.direction,
          value: record2.value,
          cpuMapping: record2.cpuMapping,
          effect: record2.effect
        })
      };
    case "runtime-bus-access":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        // Unowned accesses must never become instruction observations through a coordinate query.
        instructionAddressSpace: record2.context === "instruction" ? record2.addressSpace : null,
        instructionAddress: record2.context === "instruction" ? record2.pc : null,
        accessedAddressSpace: record2.addressSpace,
        accessedAddress: record2.address,
        coverage: null,
        payload: canonicalJson({
          ...record2.ppu ? { ppu: record2.ppu } : {},
          pc: record2.pc,
          value: record2.value,
          direction: record2.direction,
          actor: record2.actor,
          channel: record2.channel,
          phase: record2.phase,
          context: record2.context
        })
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
        instructionAddressSpace: record2.instructionAddressSpace,
        instructionAddress: record2.instructionAddress,
        accessedAddressSpace: record2.accessedAddressSpace,
        accessedAddress: record2.accessedAddress,
        coverage: null,
        payload: canonicalJson({
          access: record2.access,
          width: record2.width,
          ...record2.actor === void 0 ? {} : { actor: record2.actor },
          ...record2.channel === void 0 ? {} : { channel: record2.channel },
          ...record2.value === void 0 ? {} : { value: record2.value }
        })
      };
    case "runtime-cpu-state":
      return {
        addressSpace: record2.addressSpace,
        address: record2.address,
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
        payload: canonicalJson({ state: record2.state })
      };
    case "runtime-coverage":
      return {
        addressSpace: record2.addressSpace,
        address: null,
        start: record2.start,
        end: record2.end,
        fromAddressSpace: null,
        fromAddress: null,
        toAddressSpace: null,
        toAddress: null,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: record2.coverage,
        payload: null
      };
    case "runtime-control-target":
      return {
        addressSpace: null,
        address: null,
        start: null,
        end: null,
        fromAddressSpace: record2.fromAddressSpace,
        fromAddress: record2.fromAddress,
        toAddressSpace: record2.toAddressSpace,
        toAddress: record2.toAddress,
        instructionAddressSpace: null,
        instructionAddress: null,
        accessedAddressSpace: null,
        accessedAddress: null,
        coverage: null,
        payload: canonicalJson({ flowKind: record2.flowKind, indirect: record2.indirect })
      };
  }
  throw new Error("Unsupported runtime evidence kind.");
};
function isRowRecord2(value) {
  return !Array.isArray(value);
}
function requireString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`Invalid runtime ${label}.`);
  }
  return value;
}
function requireFinite(value, label) {
  if (!isFiniteNumber(value)) {
    throw new Error(`Invalid runtime ${label}.`);
  }
  return value;
}
function optionalFinite(record2, key3) {
  if (!Object.hasOwn(record2, key3)) {
    return void 0;
  }
  return requireFinite(record2[key3], key3);
}
function requirePayload(value) {
  if (!value) {
    throw new Error("Invalid runtime payload.");
  }
  return value;
}
function requireBytes(value) {
  if (!Array.isArray(value)) {
    throw new Error("Invalid runtime bytes.");
  }
  const bytes = [];
  for (const entry of value) {
    if (!isFiniteNumber(entry)) {
      throw new Error("Invalid runtime bytes.");
    }
    bytes.push(entry);
  }
  return bytes;
}
function isRuntimeState(value) {
  return isRecord4(value) && Object.values(value).every(
    (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry)
  );
}
function requireState(value) {
  if (!isRuntimeState(value)) {
    throw new Error("Invalid runtime state.");
  }
  return value;
}
function requireCpuSpace(value) {
  if (value === "snes.cpu") {
    return value;
  }
  throw new Error("Invalid runtime address space.");
}
function requireDirection(value) {
  if (value === "read" || value === "write") {
    return value;
  }
  throw new Error("Invalid runtime direction.");
}
function requireBusActor(value) {
  if (value === "cpu" || value === "dma" || value === "hdma") {
    return value;
  }
  throw new Error("Invalid runtime actor.");
}
function requirePhase(value) {
  if (value === "cpu" || value === "dma" || value === "hdma-indirect" || value === "hdma-table" || value === "hdma-transfer") {
    return value;
  }
  throw new Error("Invalid runtime phase.");
}
function requireContext(value) {
  if (value === "unattributed" || value === "instruction" || value === "interrupt" || value === "wait" || value === "stop") {
    return value;
  }
  throw new Error("Invalid runtime context.");
}
function requireNullableFinite(value, label) {
  if (value === null) {
    return null;
  }
  return requireFinite(value, label);
}
function requireMemoryAccess(value) {
  if (value === "read" || value === "write" || value === "read-write" || value === "unknown") {
    return value;
  }
  throw new Error("Invalid runtime access.");
}
function requireCoverage(value) {
  if (value === "executed" || value === "operand" || value === "read" || value === "written") {
    return value;
  }
  throw new Error("Invalid runtime coverage.");
}
function isPpuByte(value) {
  return isRecord4(value) && isFiniteNumber(value.address) && isFiniteNumber(value.value);
}
function requirePpu(value) {
  if (!isRecord4(value) || value.target !== "vram" && value.target !== "cgram" && value.target !== "oam" || value.outcome !== "written" && value.outcome !== "blocked" && value.outcome !== "latched" || typeof value.forcedBlank !== "boolean" || typeof value.renderingRestricted !== "boolean" || value.implementation !== "accurate" && value.implementation !== "performance" || value.vramBytes !== null && value.vramBytes !== 65536 && value.vramBytes !== 131072 || !Array.isArray(value.bytes)) {
    throw new Error("Invalid runtime ppu effect.");
  }
  const bytes = [];
  for (const entry of value.bytes) {
    if (!isPpuByte(entry)) {
      throw new Error("Invalid runtime ppu effect.");
    }
    bytes.push({ address: entry.address, value: entry.value });
  }
  return {
    target: value.target,
    outcome: value.outcome,
    forcedBlank: value.forcedBlank,
    renderingRestricted: value.renderingRestricted,
    implementation: value.implementation,
    vramBytes: value.vramBytes,
    bytes
  };
}
function readPayload(value) {
  if (value === null || value === void 0) {
    return {};
  }
  const parsed = parseSqlitePayload(value);
  return isRecord4(parsed) ? parsed : void 0;
}
var runtimeFromRow = (row) => {
  if (!isRowRecord2(row)) {
    throw new Error("Invalid runtime row.");
  }
  const extra = readPayload(row.payload);
  if (typeof row.evidence !== "string") {
    throw new Error("Missing SQLite runtime evidence dictionary entry.");
  }
  const parsedEvidence = JSON.parse(row.evidence);
  if (!isStringArray(parsedEvidence)) {
    throw new Error("Invalid runtime evidence list.");
  }
  const kind = row.kind;
  const count = Number(row.count);
  const id = decodeSqliteRuntimeIdentity(row.id_prefix, row.id);
  if (kind === "runtime-execution") {
    const body = requirePayload(extra);
    const fileOffset = optionalFinite(body, "fileOffset");
    const size = optionalFinite(body, "size");
    const opcode = optionalFinite(body, "opcode");
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      ...fileOffset === void 0 ? {} : { fileOffset },
      ...size === void 0 ? {} : { size },
      ...opcode === void 0 ? {} : { opcode }
    };
  }
  if (kind === "runtime-instruction") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      bytes: requireBytes(body.bytes),
      state: requireState(body.state)
    };
  }
  if (kind === "runtime-graphics-access") {
    const fact = {
      ...requirePayload(extra),
      addressSpace: row.accessed_address_space,
      address: row.accessed_address
    };
    if (!isRuntimeGraphicsFact(fact)) {
      throw new Error("Invalid stored graphics fact.");
    }
    return {
      ...fact,
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence
    };
  }
  if (kind === "runtime-bus-access") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      ...body.ppu === void 0 ? {} : { ppu: requirePpu(body.ppu) },
      addressSpace: requireCpuSpace(row.accessed_address_space),
      address: Number(row.accessed_address),
      pc: requireFinite(body.pc, "pc"),
      value: requireFinite(body.value, "value"),
      direction: requireDirection(body.direction),
      actor: requireBusActor(body.actor),
      channel: requireNullableFinite(body.channel, "channel"),
      phase: requirePhase(body.phase),
      context: requireContext(body.context)
    };
  }
  if (kind === "runtime-memory-access") {
    const body = requirePayload(extra);
    const actor = optionalBusActor(body);
    const channel = optionalFinite(body, "channel");
    const value = optionalFinite(body, "value");
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      instructionAddressSpace: requireString(row.instruction_address_space, "address space"),
      instructionAddress: Number(row.instruction_address),
      accessedAddressSpace: requireString(row.accessed_address_space, "address space"),
      accessedAddress: Number(row.accessed_address),
      access: requireMemoryAccess(body.access),
      width: requireFinite(body.width, "width"),
      ...actor,
      ...channel === void 0 ? {} : { channel },
      ...value === void 0 ? {} : { value }
    };
  }
  if (kind === "runtime-cpu-state") {
    const body = requirePayload(extra);
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      address: Number(row.address),
      state: requireState(body.state)
    };
  }
  if (kind === "runtime-coverage") {
    return {
      id,
      kind,
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      addressSpace: requireString(row.address_space, "address space"),
      start: Number(row.start),
      end: Number(row.end),
      coverage: requireCoverage(row.coverage)
    };
  }
  if (kind === "runtime-control-target") {
    const body = requirePayload(extra);
    return {
      id,
      kind: "runtime-control-target",
      architecture: requireString(row.architecture, "architecture"),
      count,
      evidence: parsedEvidence,
      fromAddressSpace: requireString(row.from_address_space, "address space"),
      fromAddress: Number(row.from_address),
      toAddressSpace: requireString(row.to_address_space, "address space"),
      toAddress: Number(row.to_address),
      flowKind: requireString(body.flowKind, "flow kind"),
      indirect: Boolean(body.indirect)
    };
  }
  throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
};
function optionalBusActor(record2) {
  if (!Object.hasOwn(record2, "actor")) {
    return {};
  }
  return { actor: requireBusActor(record2.actor) };
}
function allowsFinite2(value) {
  return value === void 0 || isFiniteNumber(value);
}
function isRuntimeEvidenceRecord(value) {
  if (!isRecord4(value) || typeof value.id !== "string" || typeof value.architecture !== "string" || !isFiniteNumber(value.count) || !isStringArray(value.evidence)) {
    return false;
  }
  switch (value.kind) {
    case "runtime-graphics-access":
      return isRuntimeGraphicsFact(value);
    case "runtime-execution":
      return typeof value.addressSpace === "string" && isFiniteNumber(value.address) && allowsFinite2(value.fileOffset) && allowsFinite2(value.size) && allowsFinite2(value.opcode);
    case "runtime-instruction":
      return typeof value.addressSpace === "string" && isFiniteNumber(value.address) && Array.isArray(value.bytes) && value.bytes.every(isFiniteNumber) && isRuntimeState(value.state);
    case "runtime-cpu-state":
      return typeof value.addressSpace === "string" && isFiniteNumber(value.address) && isRuntimeState(value.state);
    case "runtime-coverage":
      return typeof value.addressSpace === "string" && isFiniteNumber(value.start) && isFiniteNumber(value.end) && (value.coverage === "executed" || value.coverage === "operand" || value.coverage === "read" || value.coverage === "written");
    case "runtime-control-target":
      return typeof value.fromAddressSpace === "string" && isFiniteNumber(value.fromAddress) && typeof value.toAddressSpace === "string" && isFiniteNumber(value.toAddress) && typeof value.flowKind === "string" && typeof value.indirect === "boolean";
    case "runtime-memory-access":
      return typeof value.instructionAddressSpace === "string" && isFiniteNumber(value.instructionAddress) && typeof value.accessedAddressSpace === "string" && isFiniteNumber(value.accessedAddress) && (value.access === "read" || value.access === "write" || value.access === "read-write" || value.access === "unknown") && isFiniteNumber(value.width) && (value.actor === void 0 || value.actor === "cpu" || value.actor === "dma" || value.actor === "hdma") && allowsFinite2(value.channel) && allowsFinite2(value.value);
    case "runtime-bus-access":
      return (value.ppu === void 0 || isBusPpu(value.ppu)) && value.addressSpace === "snes.cpu" && isFiniteNumber(value.address) && isFiniteNumber(value.pc) && isFiniteNumber(value.value) && (value.direction === "read" || value.direction === "write") && (value.actor === "cpu" || value.actor === "dma" || value.actor === "hdma") && (value.channel === null || isFiniteNumber(value.channel)) && (value.phase === "cpu" || value.phase === "dma" || value.phase === "hdma-indirect" || value.phase === "hdma-table" || value.phase === "hdma-transfer") && (value.context === "unattributed" || value.context === "instruction" || value.context === "interrupt" || value.context === "wait" || value.context === "stop");
    default:
      return false;
  }
}
function isBusPpu(value) {
  return isRecord4(value) && (value.target === "vram" || value.target === "cgram" || value.target === "oam") && (value.outcome === "written" || value.outcome === "blocked" || value.outcome === "latched") && typeof value.forcedBlank === "boolean" && typeof value.renderingRestricted === "boolean" && (value.implementation === "accurate" || value.implementation === "performance") && (value.vramBytes === null || value.vramBytes === 65536 || value.vramBytes === 131072) && Array.isArray(value.bytes) && value.bytes.every(isPpuByte);
}
var analysisAddress = (record2) => {
  if ("addressSpace" in record2 && "address" in record2) {
    return { addressSpace: record2.addressSpace, address: record2.address };
  }
  if ("addressSpace" in record2 && "fromAddress" in record2) {
    return { addressSpace: record2.addressSpace, address: record2.fromAddress };
  }
  return { addressSpace: null, address: null };
};

// packages/disassembler/src/storage/sqlite-annotation-query.ts
var QUERY_LAYOUT = "5";
function isPartialInstruction(value) {
  if (!isRecord4(value)) {
    return false;
  }
  if (value.kind !== void 0 && value.kind !== "cfg-node") {
    return false;
  }
  if (value.id !== void 0 && typeof value.id !== "string") {
    return false;
  }
  if (value.addressSpace !== void 0 && typeof value.addressSpace !== "string") {
    return false;
  }
  if (value.specificationId !== void 0 && typeof value.specificationId !== "string") {
    return false;
  }
  for (const key3 of ["address", "fileOffset", "size", "opcode"]) {
    if (value[key3] !== void 0 && !isFiniteNumber(value[key3])) {
      return false;
    }
  }
  if (value.incomingState !== void 0 && !isRecord4(value.incomingState)) {
    return false;
  }
  return value.evidence === void 0 || isStringArray(value.evidence);
}
function requirePartialInstruction(value) {
  const parsed = parseSqlitePayload(value);
  if (!isPartialInstruction(parsed)) {
    throw new Error("Invalid indexed instruction.");
  }
  return parsed;
}
var runtimeSelect = (pairedState2 = false) => {
  const kind = pairedState2 ? "'runtime-cpu-state'" : "f.kind";
  const prefix = pairedState2 ? "o.state_prefix_id" : "o.prefix_id";
  const row = pairedState2 ? "-o.oid" : "o.oid";
  return `SELECT ${row} AS storage_rowid,${kind} AS kind,i.value AS id,
    p.value AS id_prefix,e.value AS evidence,o.count,f.architecture,
    f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
    f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
    f.accessed_address_space,f.accessed_address,f.coverage,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
    FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
    LEFT JOIN runtime_identities i ON i.iid=o.identity_id
    LEFT JOIN runtime_prefixes p ON p.id=${prefix}
    LEFT JOIN runtime_evidence e ON e.id=o.evidence_id`;
};
var PENDING_EXECUTIONS = `SELECT o.oid AS row_id,
  CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
  FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
  WHERE o.query_ready=0 AND f.kind='runtime-execution'`;
var annotationQueryIndexesReady = (database2) => Boolean(
  database2.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_instruction_nodes'").get()
) && database2.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v === QUERY_LAYOUT && !database2.prepare("SELECT 1 FROM query_instruction_nodes WHERE ready=0 LIMIT 1").get() && !database2.prepare(`${PENDING_EXECUTIONS} LIMIT 1`).get();
var ensureAnnotationQueryIndexes = (database2) => {
  if (database2.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !== QUERY_LAYOUT) {
    database2.exec(`DROP TRIGGER IF EXISTS query_instruction_insert; DROP TRIGGER IF EXISTS query_instruction_delete;
      DROP TRIGGER IF EXISTS query_instruction_update; DROP TRIGGER IF EXISTS query_execution_insert;
      DROP TRIGGER IF EXISTS query_execution_delete; DROP TRIGGER IF EXISTS query_execution_update;`);
    for (const name2 of ["query_instruction_nodes", "query_execution_offsets"]) {
      const row = database2.prepare("SELECT type FROM sqlite_schema WHERE name=?").get(name2);
      if (row) {
        database2.exec(`DROP ${row.type === "view" ? "VIEW" : "TABLE"} ${name2}`);
      }
    }
    for (const table of ["analysis", "runtime_observations"]) {
      const columns2 = new Set(
        database2.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name))
      );
      for (const [name2, type] of [
        ["query_file_offset", "INTEGER"],
        ["query_size", "INTEGER"],
        ["query_data", "TEXT"],
        ["query_ready", "INTEGER NOT NULL DEFAULT 0"]
      ]) {
        if (!columns2.has(name2)) {
          database2.exec(`ALTER TABLE ${table} ADD COLUMN ${name2} ${type}`);
        }
      }
    }
    database2.exec("UPDATE analysis SET query_ready=0 WHERE kind='cfg-node'");
    database2.exec(
      "UPDATE runtime_observations SET query_ready=1 WHERE fact_id IN (SELECT fid FROM runtime_facts WHERE kind!='runtime-execution') AND query_ready=0"
    );
    database2.exec(`CREATE INDEX IF NOT EXISTS analysis_location ON analysis(kind,address_space,address);
      CREATE INDEX IF NOT EXISTS query_instruction_pending ON analysis(query_ready) WHERE kind='cfg-node' AND query_ready=0;
      CREATE INDEX IF NOT EXISTS query_execution_output ON runtime_observations(query_file_offset) WHERE query_file_offset IS NOT NULL;
      CREATE INDEX IF NOT EXISTS query_execution_pending ON runtime_observations(query_ready) WHERE query_ready=0;
      CREATE VIEW query_instruction_nodes AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_data AS data,query_ready AS ready FROM analysis WHERE kind='cfg-node';
      CREATE VIEW query_execution_offsets AS SELECT rowid AS row_id,query_file_offset AS file_offset,query_size AS size,query_ready AS ready FROM runtime WHERE kind='runtime-execution';
      CREATE TRIGGER query_instruction_insert AFTER INSERT ON analysis WHEN NEW.kind='cfg-node' BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_instruction_update AFTER UPDATE OF id,kind,address_space,address,payload ON analysis BEGIN UPDATE analysis SET query_ready=0 WHERE rowid=NEW.rowid; END;
      CREATE TRIGGER query_execution_update AFTER UPDATE OF fact_id ON runtime_observations BEGIN UPDATE runtime_observations SET query_ready=0 WHERE oid=NEW.oid; END;
`);
  }
  for (const table of ["analysis", "runtime"]) {
    const pendingSql = table === "runtime" ? PENDING_EXECUTIONS : "SELECT rowid AS row_id,payload FROM analysis WHERE kind='cfg-node' AND query_ready=0";
    const pending = database2.prepare(`${pendingSql} LIMIT 1024`);
    const update = database2.prepare(
      // Execution rows always have a positive physical observation ID. Updating the compatibility
      // union view here would also search its virtual-state branch once for every execution row.
      `UPDATE ${table === "runtime" ? "runtime_observations" : table} SET query_file_offset=?,query_size=?,query_ready=1 WHERE ${table === "runtime" ? "oid" : "rowid"}=?`
    );
    const exportData = table === "analysis" ? database2.prepare("UPDATE analysis SET query_data=? WHERE rowid=?") : void 0;
    for (let rows = pending.all(); rows.length; rows = pending.all()) {
      for (const row of rows) {
        const record2 = row.payload === null ? {} : requirePartialInstruction(row.payload);
        const offset = record2.fileOffset;
        if (offset !== void 0 && (!Number.isSafeInteger(offset) || offset < 0)) {
          throw new Error("Invalid persisted instruction output offset.");
        }
        update.run(offset ?? null, record2.size ?? null, row.row_id);
        if (exportData) {
          const {
            id,
            kind,
            addressSpace,
            address,
            fileOffset,
            size,
            opcode,
            specificationId,
            incomingState,
            evidence
          } = record2;
          exportData.run(
            encodeSqlitePayload(
              JSON.stringify({
                id,
                kind,
                addressSpace,
                address,
                fileOffset,
                size,
                opcode,
                specificationId,
                incomingState,
                evidence
              })
            ),
            row.row_id
          );
        }
      }
    }
  }
  if (database2.prepare("SELECT v FROM meta WHERE k='annotation-query-layout'").get()?.v !== QUERY_LAYOUT) {
    database2.exec(
      "DROP INDEX IF EXISTS query_instruction_output; CREATE INDEX query_instruction_output ON analysis(query_file_offset,id) WHERE kind='cfg-node'"
    );
  }
  database2.prepare("INSERT OR REPLACE INTO meta(k,v) VALUES('annotation-query-layout',?)").run(QUERY_LAYOUT);
};
var readSqliteAnnotationView = (database2, manifest, ranges) => {
  if (!annotationQueryIndexesReady(database2)) {
    throw new Error("Analysis query indexes changed. Refresh the annotation view.");
  }
  validateAnnotationRanges(ranges);
  const fileSpaces = manifest.addressSpaces.filter((space) => space.kind === "file").map((space) => space.id);
  const analysis = /* @__PURE__ */ new Map();
  const locations = /* @__PURE__ */ new Map();
  const offsets = /* @__PURE__ */ new Set();
  let limited = false;
  const locate = (space, address) => {
    const key3 = `${space}:${address}`;
    if (locations.size < 2e3 || locations.has(key3)) {
      locations.set(key3, { space, address });
    } else {
      limited = true;
    }
  };
  const nodes = database2.prepare(
    "SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? AND address<? LIMIT ?"
  );
  const outputNodes = database2.prepare(
    "SELECT payload FROM analysis INDEXED BY query_instruction_output WHERE kind='cfg-node' AND query_file_offset>=? AND query_file_offset<? LIMIT ?"
  );
  const addNodes = (rows) => {
    for (const row of rows) {
      if (analysis.size >= 8192) {
        limited = true;
        break;
      }
      const record2 = requireAnalysisRecord(parseSqlitePayload(row.payload));
      analysis.set(record2.id, record2);
      if (record2.kind === "cfg-node") {
        locate(record2.addressSpace, record2.address);
        if (record2.fileOffset !== void 0) {
          offsets.add(record2.fileOffset);
        }
      }
    }
  };
  const pointLocations = database2.prepare(
    "SELECT DISTINCT address FROM runtime_facts WHERE kind=? AND address_space=? AND address>=? AND address<? LIMIT 2001"
  );
  const pairedLocations = database2.prepare(
    `SELECT DISTINCT f.address FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address>=? AND f.address<? AND o.state_prefix_id IS NOT NULL LIMIT 2001`
  );
  const memoryLocations = database2.prepare(
    "SELECT DISTINCT instruction_address AS address FROM runtime_facts WHERE kind='runtime-memory-access' AND instruction_address_space=? AND instruction_address>=? AND instruction_address<? LIMIT 2001"
  );
  const opcodeLocations = database2.prepare(
    "SELECT DISTINCT start AS address FROM annotations WHERE classification='opcode' AND address_space=? AND start>=? AND start<? LIMIT 2001"
  );
  const commentLocations = database2.prepare(
    "SELECT DISTINCT address FROM comments WHERE address_space=? AND address>=? AND address<? LIMIT 2001"
  );
  const executionOutputs = database2.prepare(
    // Joining the compatibility view to itself materialized every execution for each source line.
    // Start at the physical output-offset index and fetch only each matching observation's fact.
    `SELECT DISTINCT f.address_space,f.address,o.query_file_offset AS file_offset
      FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.query_file_offset>=? AND o.query_file_offset<? AND f.kind='runtime-execution' LIMIT 2001`
  );
  for (const range of ranges) {
    addNodes(
      nodes.iterate(range.addressSpace, range.start, range.end, Math.max(1, 8193 - analysis.size))
    );
    const queries = [{ space: range.addressSpace, start: range.start, end: range.end }];
    if (range.outputStart !== void 0 && range.outputEnd !== void 0) {
      addNodes(
        outputNodes.iterate(range.outputStart, range.outputEnd, Math.max(1, 8193 - analysis.size))
      );
      let outputCount = 0;
      for (const row of executionOutputs.iterate(range.outputStart, range.outputEnd)) {
        if (++outputCount > 2e3) {
          limited = true;
          break;
        }
        locate(String(row.address_space), Number(row.address));
        offsets.add(Number(row.file_offset));
      }
      for (const space of fileSpaces) {
        queries.push({ space, start: range.outputStart, end: range.outputEnd });
      }
    }
    for (const { space, start, end } of queries) {
      for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
        for (const row of pointLocations.iterate(kind, space, start, end)) {
          locate(space, Number(row.address));
        }
      }
      for (const query of [pairedLocations, memoryLocations, opcodeLocations, commentLocations]) {
        for (const row of query.iterate(space, start, end)) {
          locate(space, Number(row.address));
        }
      }
    }
  }
  for (const row of database2.prepare("SELECT payload FROM analysis WHERE kind='summary'").iterate()) {
    const record2 = requireAnalysisRecord(parseSqlitePayload(row.payload));
    analysis.set(record2.id, record2);
  }
  const runtime = /* @__PURE__ */ new Map();
  const executionCounts = /* @__PURE__ */ new Map();
  const point = database2.prepare(
    `${runtimeSelect()} WHERE f.kind=? AND f.address_space=? AND f.address=? ORDER BY o.oid LIMIT ?`
  );
  const pairedState2 = database2.prepare(
    `${runtimeSelect(true)} WHERE f.kind='runtime-instruction' AND f.address_space=? AND f.address=? AND o.state_prefix_id IS NOT NULL ORDER BY o.oid DESC LIMIT ?`
  );
  const memory = database2.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-memory-access' AND f.instruction_address_space=? AND f.instruction_address=? ORDER BY o.oid LIMIT ?`
  );
  const executionCount = database2.prepare(
    `SELECT COALESCE(SUM(o.count),0) AS n FROM runtime_facts f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE f.kind='runtime-execution' AND f.address_space=? AND f.address=?`
  );
  function* stateRows(space, address, limit) {
    let remaining = limit;
    for (const row of pairedState2.iterate(space, address, remaining)) {
      yield row;
      remaining--;
    }
    if (remaining > 0) {
      yield* point.iterate("runtime-cpu-state", space, address, remaining);
    }
  }
  const addRuntime = (rows, limit) => {
    let count = 0;
    for (const row of rows) {
      if (++count > limit) {
        limited = true;
        break;
      }
      const record2 = runtimeFromRow(row);
      runtime.set(record2.id, record2);
      if (record2.kind === "runtime-execution" && record2.fileOffset !== void 0) {
        offsets.add(record2.fileOffset);
      }
    }
  };
  for (const [key3, { space, address }] of locations) {
    executionCounts.set(key3, Number(executionCount.get(space, address)?.n ?? 0));
    for (const kind of ["runtime-execution", "runtime-cpu-state"]) {
      const minimum = kind === "runtime-execution" ? 1 : 0;
      const budget2 = Math.min(64, Math.max(minimum, 8192 - runtime.size));
      const rows = kind === "runtime-cpu-state" ? stateRows(space, address, budget2 + 1) : point.iterate(kind, space, address, budget2 + 1);
      addRuntime(rows, budget2);
    }
    const budget = Math.min(64, Math.max(0, 8192 - runtime.size));
    addRuntime(memory.iterate(space, address, budget + 1), budget);
  }
  const annotations = /* @__PURE__ */ new Map();
  const comments = /* @__PURE__ */ new Map();
  const intervals = database2.prepare(
    'SELECT payload FROM annotations WHERE address_space=? AND start<=? AND "end">? LIMIT 1025'
  );
  const comment = database2.prepare(
    "SELECT payload FROM comments WHERE address_space=? AND address=? LIMIT 1025"
  );
  const coverage = database2.prepare(
    `${runtimeSelect()} WHERE f.kind='runtime-coverage' AND f.address_space=? AND f.address IS NULL AND f.start<=? AND f."end">? LIMIT 1025`
  );
  const coordinates = new Map(locations);
  for (const offset of offsets) {
    for (const space of fileSpaces) {
      coordinates.set(`${space}:${offset}`, { space, address: offset });
    }
  }
  for (const { space, address } of coordinates.values()) {
    let intervalCount = 0;
    for (const row of intervals.iterate(space, address, address)) {
      if (++intervalCount > 1024 || annotations.size >= 8192) {
        limited = true;
        break;
      }
      const record2 = requireIntervalAnnotation(parseSqlitePayload(row.payload));
      annotations.set(record2.id, record2);
    }
    let commentCount = 0;
    for (const row of comment.iterate(space, address)) {
      if (++commentCount > 1024 || comments.size >= 8192) {
        limited = true;
        break;
      }
      const record2 = requireProjectComment(parseSqlitePayload(row.payload));
      comments.set(record2.id, record2);
    }
    addRuntime(
      coverage.iterate(space, address, address),
      Math.min(1024, Math.max(0, 16384 - runtime.size))
    );
  }
  return {
    shards: {
      analysis: [...analysis.values()],
      annotations: [...annotations.values()],
      comments: [...comments.values()],
      evidence: [...database2.prepare("SELECT payload FROM evidence").iterate()].map(
        (row) => requireEvidenceRecord(parseSqlitePayload(row.payload))
      ),
      labels: [],
      regions: [],
      imports: [],
      runtime: [...runtime.values()]
    },
    executionCounts,
    limited
  };
};
var validateAnnotationRanges = (ranges) => {
  if (ranges.length > 2e3) {
    throw new Error("At most 2000 visible source ranges may be projected per request.");
  }
  for (const range of ranges) {
    if (!range.addressSpace || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start || (range.outputStart !== void 0 || range.outputEnd !== void 0) && (!Number.isSafeInteger(range.outputStart) || !Number.isSafeInteger(range.outputEnd) || range.outputStart < 0 || range.outputEnd <= range.outputStart)) {
      throw new Error("Invalid instruction annotation range.");
    }
  }
};
var readInstructionExecutionSummary = (database2, manifest, ranges) => {
  validateAnnotationRanges(ranges);
  const fileSpaces = manifest.addressSpaces.filter((space) => space.kind === "file");
  const count = database2.prepare(`SELECT COALESCE(SUM(o.count),0) AS n
    FROM runtime_fact_locations f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
    WHERE f.kind='runtime-execution' AND f.address_space=? AND f.address=?
      AND (? IS NULL OR f.architecture=?)`);
  const aliases = database2.prepare(`SELECT DISTINCT f.address_space,f.address,o.query_file_offset
    FROM runtime_observations o CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
    WHERE o.query_file_offset>=? AND o.query_file_offset<? AND f.kind='runtime-execution'
      AND (? IS NULL OR f.architecture=?) LIMIT 65`);
  const logical = database2.prepare(`SELECT DISTINCT address FROM runtime_fact_locations
    WHERE kind='runtime-execution' AND address_space=? AND address>=? AND address<?
      AND (? IS NULL OR architecture=?) LIMIT 65`);
  const counts = /* @__PURE__ */ new Map();
  return ranges.map((range, rangeIndex) => {
    const locations = /* @__PURE__ */ new Map();
    let limited = false;
    const add = (addressSpace, address, offset) => {
      const key3 = `${addressSpace}:${address}`;
      let location = locations.get(key3);
      if (!location) {
        if (locations.size >= 64) {
          limited = true;
          return;
        }
        location = { addressSpace, address, offsets: /* @__PURE__ */ new Set() };
        locations.set(key3, location);
      }
      if (offset !== void 0) {
        location.offsets.add(offset);
      }
    };
    if (range.outputStart !== void 0) {
      for (const space of fileSpaces) {
        add(space.id, range.outputStart, range.outputStart);
      }
    }
    add(range.addressSpace, range.start, range.outputStart);
    const architecture = range.architecture ?? null;
    for (const row of logical.iterate(
      range.addressSpace,
      range.start,
      range.end,
      architecture,
      architecture
    )) {
      add(range.addressSpace, Number(row.address));
    }
    if (range.outputStart !== void 0 && range.outputEnd !== void 0) {
      for (const row of aliases.iterate(
        range.outputStart,
        range.outputEnd,
        architecture,
        architecture
      )) {
        add(String(row.address_space), Number(row.address), Number(row.query_file_offset));
      }
    }
    return {
      rangeIndex,
      limited,
      locations: [...locations.values()].map(({ addressSpace, address, offsets }) => {
        const key3 = `${architecture}:${addressSpace}:${address}`;
        let executionCount = counts.get(key3);
        if (executionCount === void 0) {
          const filter = fileSpaces.some((space) => space.id === addressSpace) ? null : architecture;
          executionCount = Number(count.get(addressSpace, address, filter, filter)?.n ?? 0);
          counts.set(key3, executionCount);
        }
        return { addressSpace, address, outputOffsets: [...offsets], executionCount };
      })
    };
  });
};

// packages/disassembler/src/storage/sqlite-query-cache.ts
var QUERY_CACHE_SCHEMA = "CREATE TABLE IF NOT EXISTS query_cache (name TEXT PRIMARY KEY, signature TEXT NOT NULL, payload TEXT NOT NULL)";
var installQueryCache = (db, key3, dependencies) => {
  if (!/^[\d_a-z]+$/.test(key3)) {
    throw new Error("Invalid internal query cache key.");
  }
  if (dependencies.some(
    (table) => ![
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "imports",
      "evidence",
      "runtime"
    ].includes(table)
  )) {
    throw new Error("Invalid query dependency.");
  }
  db.exec(QUERY_CACHE_SCHEMA);
  for (const table of dependencies.flatMap(
    (name2) => name2 === "runtime" ? ["runtime_fact_rows", "runtime_observations", "runtime_identities"] : [name2]
  )) {
    for (const event of ["INSERT", "UPDATE", "DELETE"]) {
      const update = table === "runtime_observations" && event === "UPDATE" ? "UPDATE OF fact_id,prefix_id,identity_id,evidence_id,count,state_prefix_id" : event;
      const condition = table === "runtime_fact_rows" && event === "UPDATE" ? "WHEN OLD.fid IS NOT NEW.fid OR OLD.fingerprint IS NOT NEW.fingerprint OR OLD.descriptor_id IS NOT NEW.descriptor_id OR NEW.history_id IS NULL" : "";
      db.exec(`CREATE TRIGGER IF NOT EXISTS cache_${key3}_${table}_${event} AFTER ${update} ON ${table} ${condition} BEGIN
      DELETE FROM query_cache WHERE name='${key3}'; END`);
    }
  }
};
var readQueryCache = (db, key3, signature) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return void 0;
  }
  const row = db.prepare("SELECT payload FROM query_cache WHERE name=? AND signature=?").get(key3, signature);
  if (!row) {
    return void 0;
  }
  const parsed = JSON.parse(String(row.payload));
  return parsed;
};
var writeQueryCache = (db, key3, signature, value) => {
  db.prepare("INSERT OR REPLACE INTO query_cache VALUES(?,?,?)").run(
    key3,
    signature,
    JSON.stringify(value)
  );
};

// packages/disassembler/src/storage/sqlite-coverage-query.ts
var COVERAGE_CLASSES = ["opcode", "operand", "data", "asset", "unknown"];
var COVERAGE_RUNTIME = ["executed", "operand", "read", "written"];
function isCoverageCounts(value, keys) {
  return isRecord4(value) && keys.every((key3) => isFiniteNumber(value[key3])) && Object.keys(value).every((key3) => keys.includes(key3));
}
function isSqliteCoverageSummary(value) {
  if (!isRecord4(value) || !isFiniteNumber(value.contentSize) || !isStringArray(value.fileAddressSpaces) || !Array.isArray(value.segments) || value.segments.length !== 0 || !Array.isArray(value.unprojected) || value.unprojected.length !== 0 || !Array.isArray(value.diagnostics) || value.diagnostics.length !== 0 || !isFiniteNumber(value.detailCount) || !isRecord4(value.summary)) {
    return false;
  }
  const summary = value.summary;
  return isFiniteNumber(summary.totalBytes) && isFiniteNumber(summary.classifiedBytes) && isFiniteNumber(summary.unknownBytes) && isFiniteNumber(summary.conflictBytes) && isFiniteNumber(summary.segmentCount) && isCoverageCounts(summary.bytesByClassification, COVERAGE_CLASSES) && isCoverageCounts(summary.bytesByRuntimeCoverage, COVERAGE_RUNTIME);
}
function requireConflict(value) {
  const record2 = requireAnalysisRecord(parseSqlitePayload(value));
  if (record2.kind !== "conflict") {
    throw new Error("Invalid stored analysis record.");
  }
  return record2;
}
function requireAccessWidth(value) {
  const parsed = parseSqlitePayload(value);
  if (!isRecord4(parsed) || typeof parsed.access !== "string" || !isFiniteNumber(parsed.width)) {
    throw new Error("Invalid runtime memory coverage payload.");
  }
  return { access: parsed.access, width: parsed.width };
}
var coverageSignature = (manifest) => JSON.stringify([1, manifest.rom, manifest.addressSpaces]);
var cachedCoverage = (db, manifest) => {
  const value = readQueryCache(db, "coverage", coverageSignature(manifest));
  if (value === void 0) {
    return void 0;
  }
  if (!isSqliteCoverageSummary(value)) {
    throw new Error("Invalid coverage summary cache.");
  }
  return value;
};
var prepareCoverage = (db, manifest) => {
  db.exec(`CREATE TEMP TABLE query_coverage_segments (start INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TEMP TABLE query_coverage_details (kind TEXT, id TEXT, reason TEXT, payload TEXT NOT NULL);
    CREATE INDEX temp.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM query_coverage_segments; DELETE FROM query_coverage_details;
    CREATE TEMP TABLE coverage_events (pos INTEGER NOT NULL, category TEXT NOT NULL, id TEXT NOT NULL, delta INTEGER NOT NULL);`);
  const fileAddressSpaces = manifest.addressSpaces.filter((s) => s.kind === "file").map((s) => s.id).toSorted((a, b) => a.localeCompare(b));
  const files = new Set(fileAddressSpaces);
  const size = manifest.rom.contentSize;
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Invalid ROM coverage size.");
  }
  const event = db.prepare("INSERT INTO temp.coverage_events VALUES(?,?,?,?)");
  const detail = db.prepare("INSERT INTO query_coverage_details VALUES(?,?,?,?)");
  const unprojected = (kind, id, reason) => {
    detail.run(
      kind,
      id,
      reason,
      JSON.stringify({
        id: `${kind}:${id}:${reason}`,
        label: id,
        description: reason,
        icon: "debug-disconnect"
      })
    );
  };
  const add = (kind, id, start, end, categories) => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
      unprojected(kind, id, "invalid-range");
      return false;
    }
    if (start >= size || size === 0) {
      unprojected(kind, id, "outside-rom");
      return false;
    }
    const clipped = Math.min(end, size);
    if (clipped !== end) {
      detail.run(
        "z-diagnostic",
        id,
        "clipped",
        JSON.stringify({
          id: `diagnostic:${id}:${start}:${end}`,
          label: id,
          description: "clipped",
          tooltip: `Clipped coverage range [${start}, ${end}) to ROM content [${start}, ${clipped}).`,
          icon: "warning"
        })
      );
    }
    for (const [category, identity] of categories) {
      event.run(start, category, identity, 1);
      event.run(clipped, category, identity, -1);
    }
    return true;
  };
  try {
    for (const row of db.prepare("SELECT * FROM annotations WHERE classification != 'unreached'").iterate()) {
      const record2 = requireIntervalAnnotation(parseSqlitePayload(row.payload));
      if (!files.has(record2.addressSpace)) {
        unprojected("annotation", record2.id, "non-file-address-space");
        continue;
      }
      let classification = "data";
      if (["opcode", "operand"].includes(record2.classification)) {
        classification = record2.classification;
      }
      if (["graphics", "music", "compressed", "asset"].includes(record2.classification)) {
        classification = "asset";
      }
      add("annotation", record2.id, record2.start, record2.end, [
        ["classification", classification],
        ["annotationIds", record2.id]
      ]);
    }
    for (const row of db.prepare("SELECT id,address_space,start,end FROM regions").iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("region", id, "non-file-address-space");
        continue;
      }
      add("region", id, Number(row.start), Number(row.end), [["regionIds", id]]);
    }
    for (const row of db.prepare(
      "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.kind='cfg-node'"
    ).iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("analysis", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("analysis", id, start, start + 1, [
        ["classification", "opcode"],
        ["analysisIds", id]
      ]);
      if (Number(row.size) > 1) {
        add("analysis", id, start + 1, start + Number(row.size), [
          ["classification", "operand"],
          ["analysisIds", id]
        ]);
      }
    }
    const node = db.prepare(
      "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.id=? AND a.kind='cfg-node'"
    );
    for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='conflict'").iterate()) {
      const record2 = requireConflict(row.payload);
      if (files.has(record2.addressSpace)) {
        add("analysis", record2.id, record2.address, record2.end ?? record2.address + 1, [
          ["conflictIds", record2.id]
        ]);
        continue;
      }
      let projected = false;
      for (const id of record2.nodes) {
        const target = node.get(id);
        if (!target || target.file_offset === null) {
          continue;
        }
        projected = add(
          "analysis",
          record2.id,
          Number(target.file_offset),
          Number(target.file_offset) + Number(target.size),
          [
            ["conflictIds", record2.id],
            ["analysisIds", id]
          ]
        ) || projected;
      }
      if (!projected) {
        unprojected("analysis", record2.id, "missing-file-offset");
      }
    }
    const identity = "p.value || CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END";
    for (const row of db.prepare(
      `SELECT ${identity} AS id,q.file_offset,q.size FROM runtime r JOIN query_execution_offsets q ON q.row_id=r.rowid JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-execution'`
    ).iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("runtime", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("runtime", id, start, start + 1, [
        ["runtime", "executed"],
        ["runtimeIds", id]
      ]);
      if (Number(row.size) > 1) {
        add("runtime", id, start + 1, start + Number(row.size), [
          ["runtime", "operand"],
          ["runtimeIds", id]
        ]);
      }
    }
    for (const row of db.prepare(
      `SELECT ${identity} AS id,r.address_space,r.start,r.end,r.coverage FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-coverage'`
    ).iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("runtime", id, "non-file-address-space");
        continue;
      }
      add("runtime", id, Number(row.start), Number(row.end), [
        ["runtime", String(row.coverage)],
        ["runtimeIds", id]
      ]);
    }
    for (const row of db.prepare(`SELECT ${identity} AS id,r.accessed_address,r.payload FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id
      WHERE r.kind='runtime-memory-access' AND r.accessed_address_space IN (SELECT value FROM json_each(?))`).iterate(JSON.stringify(fileAddressSpaces))) {
      const id = String(row.id);
      const payload = requireAccessWidth(row.payload);
      for (const [access, classification] of [
        ["read", "read"],
        ["write", "written"]
      ]) {
        if (payload.access === access || payload.access === "read-write") {
          add(
            "runtime",
            id,
            Number(row.accessed_address),
            Number(row.accessed_address) + payload.width,
            [
              ["runtime", classification],
              ["runtimeIds", id]
            ]
          );
        }
      }
    }
    event.run(0, "boundary", "", 0);
    event.run(size, "boundary", "", 0);
    const active = /* @__PURE__ */ new Map();
    const ids = (category) => [...active.get(category)?.keys() ?? []].toSorted((a, b) => a.localeCompare(b));
    const put = db.prepare("INSERT INTO query_coverage_segments VALUES(?,?)");
    const summary = {
      totalBytes: size,
      classifiedBytes: 0,
      unknownBytes: 0,
      conflictBytes: 0,
      segmentCount: 0,
      bytesByClassification: { opcode: 0, operand: 0, data: 0, asset: 0, unknown: 0 },
      bytesByRuntimeCoverage: { executed: 0, operand: 0, read: 0, written: 0 }
    };
    let classifiedBytes = 0, unknownBytes = 0, conflictBytes = 0, segmentCount = 0;
    const classificationTotals = { ...summary.bytesByClassification };
    const runtimeTotals = { ...summary.bytesByRuntimeCoverage };
    let previous = 0;
    let pending;
    let pendingKey;
    const savePending = () => {
      if (pending) {
        put.run(pending.start, JSON.stringify(pending));
        segmentCount++;
      }
    };
    const flush = (end) => {
      if (end <= previous) {
        return;
      }
      const classifications = ["opcode", "operand", "data", "asset"].filter(
        (c) => active.get("classification")?.has(c)
      );
      const runtime = ["executed", "operand", "read", "written"].filter(
        (c) => active.get("runtime")?.has(c)
      );
      const conflictIds = ids("conflictIds");
      let status = "classified";
      if (classifications.length === 0) {
        status = "unknown";
      }
      if (classifications.length > 1 || conflictIds.length) {
        status = "conflict";
      }
      const segment = {
        start: previous,
        end,
        status,
        classifications: classifications.length ? classifications : ["unknown"],
        runtime,
        annotationIds: ids("annotationIds"),
        analysisIds: ids("analysisIds"),
        runtimeIds: ids("runtimeIds"),
        conflictIds,
        regionIds: ids("regionIds")
      };
      const { start: _start, end: _end, ...segmentIdentity } = segment;
      const key3 = JSON.stringify(segmentIdentity);
      if (pending && key3 === pendingKey) {
        pending = { ...pending, end };
      } else {
        savePending();
        pending = segment;
        pendingKey = key3;
      }
      const bytes = end - previous;
      for (const c of segment.classifications) {
        classificationTotals[c] += bytes;
      }
      for (const c of runtime) {
        runtimeTotals[c] += bytes;
      }
      if (status === "classified") {
        classifiedBytes += bytes;
      } else if (status === "conflict") {
        conflictBytes += bytes;
      } else {
        unknownBytes += bytes;
      }
      previous = end;
    };
    for (const row of db.prepare(
      "SELECT pos,category,id,SUM(delta) AS delta FROM temp.coverage_events GROUP BY pos,category,id HAVING SUM(delta) != 0 OR category='boundary' ORDER BY pos,category,id"
    ).iterate()) {
      flush(Number(row.pos));
      if (row.category === "boundary") {
        continue;
      }
      const category = String(row.category), id = String(row.id);
      let values = active.get(category);
      if (!values) {
        values = /* @__PURE__ */ new Map();
        active.set(category, values);
      }
      const count = (values.get(id) ?? 0) + Number(row.delta);
      if (count === 0) {
        values.delete(id);
      } else {
        values.set(id, count);
      }
    }
    savePending();
    const result = {
      contentSize: size,
      fileAddressSpaces,
      segments: [],
      unprojected: [],
      diagnostics: [],
      detailCount: Number(db.prepare("SELECT count(*) AS n FROM query_coverage_details").get().n),
      summary: {
        ...summary,
        classifiedBytes,
        unknownBytes,
        conflictBytes,
        segmentCount,
        bytesByClassification: classificationTotals,
        bytesByRuntimeCoverage: runtimeTotals
      }
    };
    return result;
  } finally {
    db.exec("DROP TABLE temp.coverage_events");
  }
};
var publishCoverage = (db) => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_coverage_segments(start INTEGER PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS main.query_coverage_details(kind TEXT,id TEXT,reason TEXT,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS main.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM main.query_coverage_segments;INSERT INTO main.query_coverage_segments SELECT * FROM temp.query_coverage_segments;
    DELETE FROM main.query_coverage_details;INSERT INTO main.query_coverage_details SELECT * FROM temp.query_coverage_details;`);
};
var coveragePage = (db, kind, offset) => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid analysis page offset.");
  }
  const table = kind === "segments" ? "query_coverage_segments" : "query_coverage_details";
  const order = kind === "segments" ? "start" : "kind,id,reason";
  return db.prepare(`SELECT payload FROM ${table} ORDER BY ${order} LIMIT 200 OFFSET ?`).all(offset).map((row) => JSON.parse(String(row.payload)));
};
var coverageConflictPage = (db, offset) => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid analysis page offset.");
  }
  const condition = "json_extract(payload,'$.status')='conflict'";
  const count = Number(
    db.prepare(`SELECT count(*) AS n FROM query_coverage_segments WHERE ${condition}`).get().n
  );
  const segments = db.prepare(
    `SELECT payload FROM query_coverage_segments WHERE ${condition} ORDER BY start LIMIT 200 OFFSET ?`
  ).all(offset).map((row) => JSON.parse(String(row.payload)));
  return { count, segments };
};

// packages/disassembler/src/storage/sqlite-graph-query.ts
function requireNode(value) {
  const record2 = requireAnalysisRecord(parseSqlitePayload(value));
  if (record2.kind !== "cfg-node") {
    throw new Error("Invalid stored analysis record.");
  }
  return record2;
}
function requireEdge(value) {
  const record2 = requireAnalysisRecord(parseSqlitePayload(value));
  if (record2.kind !== "cfg-edge") {
    throw new Error("Invalid stored analysis record.");
  }
  return record2;
}
function requireUnresolved(value) {
  const record2 = requireAnalysisRecord(parseSqlitePayload(value));
  if (record2.kind !== "unresolved") {
    throw new Error("Invalid stored analysis record.");
  }
  return record2;
}
function requireFunctionRecord(value) {
  const record2 = requireAnalysisRecord(parseSqlitePayload(value));
  if (record2.kind !== "function") {
    throw new Error("Invalid stored analysis record.");
  }
  return record2;
}
function isLabelRefList(value) {
  return Array.isArray(value) && value.every(
    (entry) => isRecord4(entry) && typeof entry.id === "string" && typeof entry.name === "string"
  );
}
function isNumberList(value) {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
function isCallGraphFunction(value) {
  return isRecord4(value) && typeof value.id === "string" && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.source === "string" && isLabelRefList(value.labels) && isStringArray(value.nodeIds) && isNumberList(value.outputOffsets) && isStringArray(value.incomingCallIds) && isStringArray(value.outgoingCallIds) && isStringArray(value.unresolvedIds) && isStringArray(value.evidence);
}
function isCallGraphEdge(value) {
  return isRecord4(value) && typeof value.id === "string" && (value.edgeKind === "call" || value.edgeKind === "interrupt") && typeof value.addressSpace === "string" && isFiniteNumber(value.fromAddress) && isFiniteNumber(value.toAddress) && typeof value.fromNodeId === "string" && (value.toNodeId === void 0 || typeof value.toNodeId === "string") && isStringArray(value.callerFunctionIds) && isStringArray(value.calleeFunctionIds) && isNumberList(value.fromOutputOffsets) && isNumberList(value.toOutputOffsets) && typeof value.indirect === "boolean" && (value.override === void 0 || typeof value.override === "string") && (value.explanation === void 0 || typeof value.explanation === "string") && isStringArray(value.evidence);
}
function isCallGraphUnresolved(value) {
  return isRecord4(value) && typeof value.id === "string" && typeof value.addressSpace === "string" && isFiniteNumber(value.address) && typeof value.flowKind === "string" && typeof value.indirect === "boolean" && typeof value.reason === "string" && isStringArray(value.nodeIds) && isStringArray(value.ownerFunctionIds) && isNumberList(value.outputOffsets) && isStringArray(value.evidence);
}
function isCallGraph(value) {
  return isRecord4(value) && Array.isArray(value.functions) && value.functions.every(isCallGraphFunction) && Array.isArray(value.calls) && value.calls.every(isCallGraphEdge) && Array.isArray(value.unresolved) && value.unresolved.every(isCallGraphUnresolved) && isStringArray(value.orphanCallIds) && isStringArray(value.orphanUnresolvedIds);
}
function requireCallKind(value) {
  if (value === "call" || value === "interrupt") {
    return value;
  }
  throw new Error("Invalid call graph edge.");
}
var unique = (ids) => [...new Set(ids)].toSorted((a, b) => a.localeCompare(b));
var numbers = (ids) => [...new Set(ids)].toSorted((a, b) => a - b);
var append = (map, owner, id) => {
  let ids = map.get(owner);
  if (!ids) {
    ids = [];
    map.set(owner, ids);
  }
  ids.push(id);
};
var prepareGraph = (db) => {
  db.exec(`CREATE TEMP TABLE query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX temp.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TEMP TABLE query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM query_graph_nodes; DELETE FROM query_graph_edges;`);
  const entries = new Set(
    db.prepare(
      "SELECT n.id FROM analysis n JOIN analysis f ON f.kind='function' AND n.address_space=f.address_space AND n.address=f.address WHERE n.kind='cfg-node'"
    ).all().map((row) => String(row.id))
  );
  const putNode = db.prepare("INSERT INTO query_graph_nodes VALUES(?,?,?,?,?)");
  const putEdge = db.prepare("INSERT INTO query_graph_edges VALUES(?,?,?,?,?,?)");
  for (const row of db.prepare("SELECT kind,payload FROM analysis WHERE kind IN ('cfg-node','cfg-edge')").iterate()) {
    if (row.kind === "cfg-node") {
      const node = requireNode(row.payload);
      const path10 = node.evidencePath.length ? node.evidencePath : [node.id];
      let owner = node.functionEntry;
      for (let i = path10.length - 1; i >= 0; i--) {
        if (owner) {
          break;
        }
        if (entries.has(path10[i])) {
          owner = path10[i];
          break;
        }
      }
      putNode.run(node.id, node.addressSpace, node.address, node.fileOffset ?? null, owner ?? null);
    } else {
      const edge = requireEdge(row.payload);
      if (edge.edgeKind === "unresolved" || ["call", "interrupt"].includes(edge.edgeKind) && edge.toAddress !== void 0) {
        putEdge.run(
          edge.id,
          edge.edgeKind,
          edge.addressSpace,
          edge.fromAddress,
          edge.from,
          JSON.stringify(edge)
        );
      }
    }
  }
  const ownersQuery = db.prepare(`SELECT f.id FROM query_graph_nodes n JOIN query_graph_nodes e ON e.id=n.owner
    JOIN analysis f ON f.kind='function' AND f.address_space=e.address_space AND f.address=e.address WHERE n.id=?`);
  const owners = (id) => unique(ownersQuery.all(id).map((row) => String(row.id)));
  const offsetQuery = db.prepare(
    "SELECT file_offset FROM query_graph_nodes WHERE id=? AND file_offset IS NOT NULL"
  );
  const offsets = (ids) => numbers(ids.flatMap((id) => offsetQuery.all(id).map((row) => Number(row.file_offset))));
  const functionsAt = db.prepare(
    "SELECT id FROM analysis WHERE kind='function' AND address_space=? AND address=?"
  );
  const calls = [];
  for (const row of db.prepare("SELECT payload FROM query_graph_edges WHERE kind IN ('call','interrupt')").iterate()) {
    const edge = requireEdge(row.payload);
    calls.push({
      id: edge.id,
      edgeKind: requireCallKind(edge.edgeKind),
      addressSpace: edge.addressSpace,
      fromAddress: edge.fromAddress,
      toAddress: edge.toAddress,
      fromNodeId: edge.from,
      ...edge.to ? { toNodeId: edge.to } : {},
      callerFunctionIds: owners(edge.from),
      calleeFunctionIds: unique(
        functionsAt.all(edge.addressSpace, edge.toAddress).map((functionRow) => String(functionRow.id))
      ),
      fromOutputOffsets: offsets([edge.from]),
      toOutputOffsets: offsets(edge.to ? [edge.to] : []),
      indirect: edge.indirect,
      ...edge.override ? { override: edge.override } : {},
      ...edge.explanation ? { explanation: edge.explanation } : {},
      evidence: edge.evidence
    });
  }
  const unresolved = [];
  const unresolvedNodes = db.prepare(
    "SELECT from_id FROM query_graph_edges WHERE kind='unresolved' AND address_space=? AND from_address=?"
  );
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='unresolved'").iterate()) {
    const record2 = requireUnresolved(row.payload);
    const nodeIds = unique(
      unresolvedNodes.all(record2.addressSpace, record2.address).map((nodeRow) => String(nodeRow.from_id))
    );
    unresolved.push({
      id: record2.id,
      addressSpace: record2.addressSpace,
      address: record2.address,
      flowKind: record2.flowKind,
      indirect: record2.indirect,
      reason: record2.reason,
      nodeIds,
      ownerFunctionIds: unique(nodeIds.flatMap(owners)),
      outputOffsets: offsets(nodeIds),
      evidence: record2.evidence
    });
  }
  const incoming = /* @__PURE__ */ new Map(), outgoing = /* @__PURE__ */ new Map(), unresolvedByOwner = /* @__PURE__ */ new Map();
  for (const call of calls) {
    for (const id of call.callerFunctionIds) {
      append(outgoing, id, call.id);
    }
    for (const id of call.calleeFunctionIds) {
      append(incoming, id, call.id);
    }
  }
  for (const record2 of unresolved) {
    for (const id of record2.ownerFunctionIds) {
      append(unresolvedByOwner, id, record2.id);
    }
  }
  const owned = db.prepare(
    "SELECT n.id,n.address,n.file_offset FROM query_graph_nodes e JOIN query_graph_nodes n ON n.owner=e.id WHERE e.address_space=? AND e.address=?"
  );
  const labels = db.prepare("SELECT payload FROM labels WHERE address_space=? AND address=?");
  const functions = [];
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='function'").iterate()) {
    const fn = requireFunctionRecord(row.payload);
    const nodes = owned.all(fn.addressSpace, fn.address);
    functions.push({
      id: fn.id,
      addressSpace: fn.addressSpace,
      address: fn.address,
      source: fn.source,
      labels: labels.all(fn.addressSpace, fn.address).map((labelRow) => {
        const { id, name: name2 } = requireProjectLabel(parseSqlitePayload(labelRow.payload));
        return { id, name: name2 };
      }).toSorted((a, b) => a.id.localeCompare(b.id)),
      nodeIds: unique(nodes.map((nodeRow) => String(nodeRow.id))),
      outputOffsets: numbers(
        nodes.filter((nodeRow) => nodeRow.address === fn.address && nodeRow.file_offset !== null).map((nodeRow) => Number(nodeRow.file_offset))
      ),
      incomingCallIds: unique(incoming.get(fn.id) ?? []),
      outgoingCallIds: unique(outgoing.get(fn.id) ?? []),
      unresolvedIds: unique(unresolvedByOwner.get(fn.id) ?? []),
      evidence: fn.evidence
    });
  }
  functions.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.address - b.address || a.id.localeCompare(b.id)
  );
  calls.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.fromAddress - b.fromAddress || a.toAddress - b.toAddress || a.id.localeCompare(b.id)
  );
  unresolved.sort(
    (a, b) => a.addressSpace.localeCompare(b.addressSpace) || a.address - b.address || a.id.localeCompare(b.id)
  );
  const graph = {
    functions,
    calls,
    unresolved,
    orphanCallIds: unique(
      calls.filter((c) => !c.callerFunctionIds.length || !c.calleeFunctionIds.length).map((c) => c.id)
    ),
    orphanUnresolvedIds: unique(
      unresolved.filter((r) => !r.ownerFunctionIds.length).map((r) => r.id)
    )
  };
  return graph;
};
var publishGraph = (db) => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX IF NOT EXISTS main.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TABLE IF NOT EXISTS main.query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM main.query_graph_nodes;INSERT INTO main.query_graph_nodes SELECT * FROM temp.query_graph_nodes;
    DELETE FROM main.query_graph_edges;INSERT INTO main.query_graph_edges SELECT * FROM temp.query_graph_edges;`);
};

// packages/disassembler/src/storage/sqlite-graphics-query.ts
function queryGraphicsEvidence(db, query) {
  const limit = query.limit ?? 500;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2e3 || [query.pc, query.physicalOffset].some(
    (value) => value !== void 0 && (!Number.isSafeInteger(value) || value < 0)
  ) || query.captureSha256 !== void 0 && !/^[\da-f]{64}$/.test(query.captureSha256)) {
    throw new Error("Invalid graphics evidence query.");
  }
  const cpu = db.prepare(`SELECT COUNT(DISTINCT f.fid) AS variants,COALESCE(SUM(o.count),0) AS observations
    FROM runtime_facts f JOIN runtime_observations o ON o.fact_id=f.fid
    WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=? AND f.address=?
    AND json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,?)=?`);
  const rows = db.prepare(`SELECT f.*,o.count,p.value AS id_prefix,i.value AS id,e.value AS evidence,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
    FROM runtime_facts f JOIN runtime_observations o ON o.fact_id=f.fid
    JOIN runtime_prefixes p ON p.id=o.prefix_id JOIN runtime_identities i ON i.iid=o.identity_id
    JOIN runtime_evidence e ON e.id=o.evidence_id
    WHERE f.kind='runtime-graphics-access' AND f.architecture=? AND f.accessed_address_space=?
    AND (? IS NULL OR json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,'$.pc')=?)
    AND (? IS NULL OR json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,'$.cpuMapping.physicalOffset')=?)
    AND (? IS NULL OR p.value=?) ORDER BY o.oid LIMIT ?`);
  const joins = /* @__PURE__ */ new Map();
  const result = [];
  for (const row of rows.iterate(
    query.architecture,
    query.addressSpace,
    query.pc ?? null,
    query.pc ?? null,
    query.physicalOffset ?? null,
    query.physicalOffset ?? null,
    query.captureSha256 ?? null,
    query.captureSha256 ? `runtime:graphics:${query.captureSha256}:` : null,
    limit
  )) {
    const graphics = runtimeFromRow(row);
    if (graphics.kind !== "runtime-graphics-access") {
      throw new Error("Invalid graphics query row.");
    }
    let match = { variants: 0, observations: 0 };
    if (graphics.context === "instruction" && graphics.cpuMapping) {
      const key3 = JSON.stringify([graphics.pc, graphics.cpuMapping]);
      const cached = joins.get(key3);
      if (cached) {
        match = cached;
      } else {
        const matched = cpu.get(
          query.architecture,
          query.addressSpace,
          graphics.pc,
          `$.state."${graphics.cpuMapping.offsetStateField}"`,
          graphics.cpuMapping.physicalOffset
        );
        match = { variants: Number(matched.variants), observations: Number(matched.observations) };
        joins.set(key3, match);
      }
    }
    result.push({
      graphics,
      instructionVariants: match.variants,
      instructionObservations: match.observations
    });
  }
  return result;
}

// packages/disassembler/src/storage/sqlite-research-inputs.ts
init_canonical_json();
var SCHEMA = `CREATE TABLE IF NOT EXISTS research_projection (
  collection TEXT NOT NULL, id TEXT NOT NULL, baseline BLOB, projected BLOB,
  PRIMARY KEY(collection,id)
) WITHOUT ROWID;`;
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isResearchCollection2(value) {
  return value === "labels" || value === "comments" || value === "annotations" || value === "regions" || value === "analysis" || value === "evidence";
}
var collectionName = (value) => {
  if (typeof value !== "string" || !isResearchCollection2(value)) {
    throw new Error("Invalid research projection collection.");
  }
  return value;
};
var recordValue = (payload) => payload == null ? null : JSON.parse(decodeSqlitePayload(payload));
function analysisInput(collection, value) {
  if (value === null || collection === "comments") {
    return null;
  }
  if (!isRecord7(value)) {
    throw new Error("Invalid research record.");
  }
  const record2 = value;
  if (collection === "labels") {
    if (record2.analysisEntryPoint === false) {
      return null;
    }
    return {
      id: record2.id,
      addressSpace: record2.addressSpace,
      address: record2.address,
      evidence: record2.evidence
    };
  }
  if (collection === "analysis" && !["target-override", "target-set"].includes(String(record2.kind))) {
    return null;
  }
  return record2;
}
function changesAnalysisInputs(database2, snapshot) {
  database2.exec(SCHEMA);
  const selected = new Map(
    snapshot.decisions.map((decision) => [`${decision.collection}:${decision.id}`, decision])
  );
  const before = /* @__PURE__ */ new Map();
  for (const row of database2.prepare("SELECT collection,id,baseline FROM research_projection").iterate()) {
    const collection = collectionName(row.collection);
    const id = String(row.id);
    before.set(`${collection}:${id}`, { collection, id, baseline: recordValue(row.baseline) });
  }
  for (const key3 of /* @__PURE__ */ new Set([...selected.keys(), ...before.keys()])) {
    const decision = selected.get(key3);
    const previous = before.get(key3);
    const { collection, id } = decision ?? previous;
    const current = recordValue(
      database2.prepare(`SELECT payload FROM ${collection} WHERE id=?`).get(id)?.payload
    );
    const next = decision ? decision.value : previous.baseline;
    if (!canonicalEquals(analysisInput(collection, current), analysisInput(collection, next))) {
      return true;
    }
  }
  return false;
}
function clearResearchProjection(database2, insert) {
  database2.exec(SCHEMA);
  for (const row of database2.prepare("SELECT * FROM research_projection ORDER BY collection,id").iterate()) {
    const collection = collectionName(row.collection);
    if (typeof row.id !== "string") {
      throw new Error("Invalid research projection record identity.");
    }
    const current = database2.prepare(`SELECT payload FROM ${collection} WHERE id=?`).get(row.id);
    if (!canonicalEquals(recordValue(current?.payload), recordValue(row.projected))) {
      throw new Error(
        `Research index changed outside its authoring files: ${collection}:${row.id}. Reconcile the evidence writer before rebuilding the index.`
      );
    }
    database2.prepare(`DELETE FROM ${collection} WHERE id=?`).run(row.id);
    const baseline = recordValue(row.baseline);
    if (baseline !== null) {
      insert(collection, baseline);
    }
  }
  database2.exec(
    "DELETE FROM research_projection; DELETE FROM meta WHERE k IN ('research-inputs','research-index-revision')"
  );
}
function projectResearchInputs(database2, snapshot, insert) {
  const changed = changesAnalysisInputs(database2, snapshot);
  clearResearchProjection(database2, insert);
  const remember = database2.prepare("INSERT INTO research_projection VALUES (?,?,?,?)");
  for (const decision of snapshot.decisions) {
    const collection = collectionName(decision.collection);
    const before = database2.prepare(`SELECT payload FROM ${collection} WHERE id=?`).get(decision.id);
    if (collection === "evidence" && before) {
      const observation = recordValue(before.payload);
      if (!isRecord7(observation) || observation.source !== "manual") {
        throw new Error("Git research cannot replace or suppress imported/runtime provenance.");
      }
    }
    const projected = decision.value === null ? null : encodeSqlitePayload(canonicalJson(decision.value));
    remember.run(collection, decision.id, before?.payload ?? null, projected);
    database2.prepare(`DELETE FROM ${collection} WHERE id=?`).run(decision.id);
    if (decision.value !== null) {
      insert(collection, decision.value);
    }
  }
  database2.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('research-inputs',?)").run(snapshot.hash);
  if (changed) {
    database2.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('analysis-dirty',?)").run(
      "Research classification, entry points, targets or evidence changed. Analyze the selected inputs before regenerating or querying the derived graph."
    );
  }
}

// packages/disassembler/src/storage/sqlite-runtime-batch.ts
init_canonical_json();

// packages/disassembler/src/storage/sqlite-runtime-facts.ts
var RUNTIME_DESCRIPTOR_COLUMNS = [
  "kind",
  "architecture",
  "address_space",
  "address",
  "start",
  "end",
  "from_address_space",
  "from_address",
  "to_address_space",
  "to_address",
  "instruction_address_space",
  "instruction_address",
  "accessed_address_space",
  "accessed_address",
  "coverage"
];
var runtimeIdentityKey = (column) => `CASE WHEN typeof(${column})='blob' THEN substr(${column},1,8) ELSE ${column} END`;
var columns = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",");
var inserted = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `NEW."${column}"`).join(",");
var key2 = `json_array(${inserted})`;
var descriptorInsert = `INSERT OR IGNORE INTO runtime_descriptors(key,${columns}) VALUES(${key2},${inserted});`;
var descriptorId = `(SELECT did FROM runtime_descriptors WHERE key=${key2})`;
var RUNTIME_FACT_SCHEMA = `
CREATE TABLE runtime_descriptors (
  did INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL, architecture TEXT NOT NULL,
  address_space TEXT, address INTEGER, start INTEGER, "end" INTEGER,
  from_address_space TEXT, from_address INTEGER, to_address_space TEXT, to_address INTEGER,
  instruction_address_space TEXT, instruction_address INTEGER,
  accessed_address_space TEXT, accessed_address INTEGER, coverage TEXT
);
CREATE INDEX runtime_lookup ON runtime_descriptors(kind,address_space,address,start);
CREATE INDEX runtime_memory ON runtime_descriptors(instruction_address_space,instruction_address) WHERE kind='runtime-memory-access';
CREATE TABLE runtime_fact_rows (
  fid INTEGER PRIMARY KEY, fingerprint BLOB,
  descriptor_id INTEGER NOT NULL REFERENCES runtime_descriptors(did),
  payload BLOB, history_id INTEGER REFERENCES runtime_history(id), history_slot INTEGER,
  CHECK ((history_id IS NULL AND history_slot IS NULL) OR
    (history_id IS NOT NULL AND history_slot>=0 AND payload IS NULL))
);
CREATE INDEX runtime_fact_fingerprint ON runtime_fact_rows(substr(fingerprint,1,8));
CREATE INDEX runtime_fact_descriptor ON runtime_fact_rows(descriptor_id);
CREATE INDEX runtime_history_pending ON runtime_fact_rows(fid) WHERE history_id IS NULL;
CREATE TRIGGER runtime_fact_unique_insert BEFORE INSERT ON runtime_fact_rows
WHEN NEW.fingerprint IS NOT NULL AND EXISTS(
  SELECT 1 FROM runtime_fact_rows WHERE substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8) AND fingerprint=NEW.fingerprint AND fid IS NOT NEW.fid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime fact fingerprint'); END;
CREATE TRIGGER runtime_fact_unique_update BEFORE UPDATE OF fingerprint ON runtime_fact_rows
WHEN NEW.fingerprint IS NOT NULL AND EXISTS(
  SELECT 1 FROM runtime_fact_rows WHERE substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8)
    AND fingerprint=NEW.fingerprint AND fid!=OLD.fid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime fact fingerprint'); END;
CREATE VIEW runtime_fact_locations AS SELECT f.fid,
  ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `d."${column}"`).join(",")}
FROM runtime_fact_rows f LEFT JOIN runtime_descriptors d ON d.did=f.descriptor_id;
CREATE VIEW runtime_facts AS SELECT f.fid,f.fingerprint,
  ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `d."${column}"`).join(",")},
  CASE WHEN f.history_id IS NULL THEN f.payload
    ELSE analysis_history_payload(f.history_id,f.history_slot) END AS payload
FROM runtime_fact_rows f LEFT JOIN runtime_descriptors d ON d.did=f.descriptor_id;
CREATE TRIGGER runtime_fact_insert INSTEAD OF INSERT ON runtime_facts BEGIN
  ${descriptorInsert}
  INSERT INTO runtime_fact_rows(fid,fingerprint,descriptor_id,payload)
    VALUES(NEW.fid,NEW.fingerprint,${descriptorId},NEW.payload);
END;
CREATE TRIGGER runtime_fact_update INSTEAD OF UPDATE ON runtime_facts BEGIN
  ${descriptorInsert}
  UPDATE runtime_fact_rows SET fid=NEW.fid,fingerprint=NEW.fingerprint,
    descriptor_id=${descriptorId},payload=NEW.payload,history_id=NULL,history_slot=NULL WHERE fid=OLD.fid;
END;
CREATE TRIGGER runtime_fact_delete INSTEAD OF DELETE ON runtime_facts BEGIN
  DELETE FROM runtime_fact_rows WHERE fid=OLD.fid;
END;
`;
var RUNTIME_IDENTITY_SCHEMA = `
CREATE TABLE runtime_identities(iid INTEGER PRIMARY KEY,value BLOB NOT NULL);
CREATE INDEX runtime_identity_key ON runtime_identities(${runtimeIdentityKey("value")});
CREATE TRIGGER runtime_identity_unique_insert BEFORE INSERT ON runtime_identities
WHEN EXISTS(SELECT 1 FROM runtime_identities
  WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND value=NEW.value)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime identity'); END;
CREATE TRIGGER runtime_identity_unique_update BEFORE UPDATE OF value ON runtime_identities
WHEN EXISTS(SELECT 1 FROM runtime_identities
  WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND value=NEW.value AND iid!=OLD.iid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime identity'); END;
`;

// packages/disassembler/src/storage/sqlite-runtime-storage.ts
var import_node_crypto2 = require("node:crypto");
init_canonical_json();

// packages/disassembler/src/storage/sqlite-runtime-history.ts
var import_node_util2 = require("node:util");
var import_node_zlib3 = require("node:zlib");
function historyPayload(value) {
  if (value === null || typeof value === "string" || import_node_util2.types.isUint8Array(value)) {
    return value;
  }
  throw new Error("Invalid runtime history payload.");
}
var MAGIC2 = Buffer.from([85, 72, 66, 1]);
var MAX_ROWS = 1024;
var MAX_BYTES = 32 * 1024 * 1024;
var TARGET_BYTES = 256 * 1024;
var CACHE_BYTES = 4 * 1024 * 1024;
var utf82 = new import_node_util2.TextDecoder("utf-8", { fatal: true });
var RUNTIME_HISTORY_SCHEMA = `CREATE TABLE runtime_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, first_fid INTEGER NOT NULL, last_fid INTEGER NOT NULL,
  payload BLOB NOT NULL
);
CREATE TRIGGER runtime_history_immutable BEFORE UPDATE ON runtime_history BEGIN
  SELECT RAISE(ABORT,'Runtime history blocks are immutable');
END;`;
var encodeRuntimeHistory = (values) => {
  if (!values.length || values.length > MAX_ROWS) {
    throw new Error("Invalid runtime history record count.");
  }
  const records = values.map((value) => {
    if (value === null) {
      return Buffer.from([0]);
    }
    const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
    return Buffer.concat([Buffer.from([typeof value === "string" ? 1 : 2]), bytes]);
  });
  const directoryBytes = (values.length + 1) * 4;
  const size = directoryBytes + records.reduce((n, record2) => n + record2.length, 0);
  if (size > MAX_BYTES) {
    throw new Error("Runtime history block exceeds its decoded byte limit.");
  }
  const body = Buffer.allocUnsafe(size);
  let offset = directoryBytes;
  for (const [index, record2] of records.entries()) {
    body.writeUInt32LE(offset, index * 4);
    record2.copy(body, offset);
    offset += record2.length;
  }
  body.writeUInt32LE(offset, values.length * 4);
  const header = Buffer.allocUnsafe(16);
  MAGIC2.copy(header);
  header.writeUInt32LE(values.length, 4);
  header.writeUInt32LE(size, 8);
  header.writeUInt32LE((0, import_node_zlib3.crc32)(body), 12);
  return Buffer.concat([header, (0, import_node_zlib3.deflateSync)(body, { level: 6 })]);
};
var decodeHistoryBlock = (encoded) => {
  const bytes = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
  if (bytes.length < 17 || !bytes.subarray(0, 4).equals(MAGIC2)) {
    throw new Error("Unsupported runtime history block.");
  }
  const count = bytes.readUInt32LE(4);
  const size = bytes.readUInt32LE(8);
  if (!count || count > MAX_ROWS || size < (count + 1) * 4 + count || size > MAX_BYTES) {
    throw new Error("Invalid runtime history block bounds.");
  }
  const body = (0, import_node_zlib3.inflateSync)(bytes.subarray(16), { maxOutputLength: size });
  if (body.length !== size || (0, import_node_zlib3.crc32)(body) !== bytes.readUInt32LE(12)) {
    throw new Error("Corrupt runtime history block.");
  }
  let start = body.readUInt32LE(0);
  if (start !== (count + 1) * 4) {
    throw new Error("Invalid runtime history offset directory.");
  }
  for (let index = 0; index < count; index++) {
    const end = body.readUInt32LE((index + 1) * 4);
    if (end <= start || end > size) {
      throw new Error("Invalid runtime history record extent.");
    }
    const type = body[start];
    if (type === 0 && end !== start + 1 || type !== 0 && type !== 1 && type !== 2) {
      throw new Error("Invalid runtime history storage type.");
    }
    start = end;
  }
  if (start !== size) {
    throw new Error("Trailing runtime history bytes.");
  }
  return { body, count };
};
var historyValue = (block, slot) => {
  const start = block.body.readUInt32LE(slot * 4);
  const end = block.body.readUInt32LE((slot + 1) * 4);
  const type = block.body[start];
  if (type === 0) {
    return null;
  }
  const value = block.body.subarray(start + 1, end);
  return type === 1 ? utf82.decode(value) : value;
};
var registerRuntimeHistory = (db) => {
  const cache = /* @__PURE__ */ new Map();
  let used = 0;
  let read;
  db.function("analysis_history_payload", (id, slot) => {
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || typeof slot !== "number" || !Number.isSafeInteger(slot) || slot < 0) {
      throw new Error("Invalid runtime history reference.");
    }
    let block = cache.get(id);
    if (!block) {
      read ??= db.prepare("SELECT payload FROM runtime_history WHERE id=?");
      const encoded = read.get(id)?.payload;
      if (!import_node_util2.types.isUint8Array(encoded)) {
        throw new Error("Missing runtime history block.");
      }
      block = decodeHistoryBlock(encoded);
      const size = block.body.byteLength + 128;
      if (size <= CACHE_BYTES) {
        while (used + size > CACHE_BYTES) {
          const first = cache.keys().next().value;
          used -= cache.get(first).body.byteLength + 128;
          cache.delete(first);
        }
        cache.set(id, block);
        used += size;
      }
    }
    if (slot >= block.count) {
      throw new Error("Runtime history slot is out of bounds.");
    }
    return historyValue(block, slot);
  });
  return () => {
    cache.clear();
    used = 0;
  };
};
var packRuntimeHistory = (db, onProgress) => {
  if (!db.isTransaction) {
    throw new Error("Runtime history packing requires a transaction.");
  }
  const pending = db.prepare(
    "SELECT fid,payload FROM runtime_fact_rows WHERE history_id IS NULL ORDER BY fid LIMIT ?"
  );
  const insert = db.prepare(
    "INSERT INTO runtime_history(first_fid,last_fid,payload) VALUES(?,?,?)"
  );
  const update = db.prepare(
    "UPDATE runtime_fact_rows SET payload=NULL,history_id=?,history_slot=? WHERE fid=?"
  );
  let packed = 0;
  for (; ; ) {
    const rows = [];
    let size = 0;
    for (const row of pending.iterate(MAX_ROWS)) {
      const value = historyPayload(row.payload);
      const bytes = typeof value === "string" ? Buffer.byteLength(value) : value?.byteLength ?? 0;
      if (rows.length && size + bytes > TARGET_BYTES) {
        break;
      }
      rows.push(row);
      size += bytes;
    }
    if (!rows.length) {
      return packed;
    }
    const encoded = encodeRuntimeHistory(rows.map((row) => historyPayload(row.payload)));
    const id = insert.run(rows[0].fid, rows[rows.length - 1].fid, encoded).lastInsertRowid;
    for (const [slot, row] of rows.entries()) {
      update.run(id, slot, row.fid);
    }
    packed += rows.length;
    onProgress?.(packed);
  }
};
var collectRuntimeHistory = (db) => {
  db.exec(`DELETE FROM runtime_history WHERE NOT EXISTS(
    SELECT 1 FROM runtime_fact_rows f WHERE f.fid>=runtime_history.first_fid
      AND f.fid<=runtime_history.last_fid AND f.history_id=runtime_history.id);
    DELETE FROM runtime_descriptors WHERE NOT EXISTS(
      SELECT 1 FROM runtime_fact_rows f WHERE f.descriptor_id=runtime_descriptors.did);`);
};

// packages/disassembler/src/storage/sqlite-runtime-storage.ts
var runtimeFactFingerprint = (record2, columns2) => (0, import_node_crypto2.createHash)("sha256").update(
  JSON.stringify(
    {
      accessedAddress: columns2.accessedAddress,
      accessedAddressSpace: columns2.accessedAddressSpace,
      address: columns2.address,
      addressSpace: columns2.addressSpace,
      architecture: record2.architecture,
      coverage: columns2.coverage,
      end: columns2.end,
      fromAddress: columns2.fromAddress,
      fromAddressSpace: columns2.fromAddressSpace,
      instructionAddress: columns2.instructionAddress,
      instructionAddressSpace: columns2.instructionAddressSpace,
      kind: record2.kind,
      payload: columns2.payload,
      start: columns2.start,
      toAddress: columns2.toAddress,
      toAddressSpace: columns2.toAddressSpace
    },
    void 0,
    2
  ) + "\n"
).digest();
var encodeRuntimeFactPayload = (record2, payload) => {
  if (payload === null) {
    return null;
  }
  if (record2.architecture === "snes.65816" && (record2.kind === "runtime-instruction" || record2.kind === "runtime-cpu-state")) {
    const snapshot = record2.kind === "runtime-instruction" ? { bytes: record2.bytes, state: record2.state } : { state: record2.state };
    return encodePackedRuntimePayload(snapshot) ?? encodeSqlitePayload(payload);
  }
  return encodeSqlitePayload(payload);
};
var RUNTIME_RECORD_STREAM_SQL = [true, false].map(
  (paired) => `
  SELECT i.value AS id,p.value AS id_prefix,e.value AS evidence,o.count,
    ${paired ? "'runtime-cpu-state'" : "f.kind"} AS kind,f.architecture,
    f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
    f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
    f.accessed_address_space,f.accessed_address,f.coverage,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
  FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
  LEFT JOIN runtime_identities i ON i.iid=o.identity_id
  LEFT JOIN runtime_prefixes p ON p.id=o.${paired ? "state_prefix_id" : "prefix_id"}
  LEFT JOIN runtime_evidence e ON e.id=o.evidence_id
  ${paired ? "WHERE o.state_prefix_id IS NOT NULL" : ""}
  ORDER BY o.oid ${paired ? "DESC" : "ASC"}`
);
var RUNTIME_STORAGE_SCHEMA = `
${RUNTIME_HISTORY_SCHEMA}
${RUNTIME_FACT_SCHEMA}
${RUNTIME_IDENTITY_SCHEMA}
CREATE TABLE runtime_observations (
  oid INTEGER PRIMARY KEY, fact_id INTEGER NOT NULL REFERENCES runtime_fact_rows(fid),
  prefix_id INTEGER NOT NULL REFERENCES runtime_prefixes(id),
  identity_id INTEGER NOT NULL REFERENCES runtime_identities(iid),
  evidence_id INTEGER NOT NULL REFERENCES runtime_evidence(id), count INTEGER NOT NULL,
  state_prefix_id INTEGER REFERENCES runtime_prefixes(id),
  query_file_offset INTEGER, query_size INTEGER, query_data BLOB, query_ready INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix_id,identity_id), UNIQUE(state_prefix_id,identity_id)
);
CREATE INDEX runtime_observation_fact ON runtime_observations(fact_id);
-- Native fact and identity IDs commonly coincide. The fact index already covers that case;
-- index only exceptions, and check both cases before collecting an identity below.
CREATE INDEX runtime_observation_identity ON runtime_observations(identity_id) WHERE identity_id!=fact_id;
CREATE VIEW runtime AS
 SELECT o.oid AS rowid,o.prefix_id,i.value AS id,f.kind,f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload,
 o.query_file_offset,o.query_size,o.query_data,o.query_ready
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
 LEFT JOIN runtime_identities i ON i.iid=o.identity_id
 UNION ALL
 SELECT -o.oid,o.state_prefix_id,i.value,'runtime-cpu-state',f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END,NULL,NULL,NULL,1
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
 LEFT JOIN runtime_identities i ON i.iid=o.identity_id WHERE o.state_prefix_id IS NOT NULL;
CREATE TRIGGER runtime_collect_fact AFTER DELETE ON runtime_observations BEGIN
 -- Reclaim the physical owner directly: deleting a fact does not require decoding its payload.
 DELETE FROM runtime_fact_rows WHERE fid=OLD.fact_id AND NOT EXISTS(SELECT 1 FROM runtime_observations WHERE fact_id=OLD.fact_id);
 DELETE FROM runtime_identities WHERE iid=OLD.identity_id
   AND NOT EXISTS(SELECT 1 FROM runtime_observations WHERE fact_id=OLD.identity_id AND identity_id=OLD.identity_id)
   AND NOT EXISTS(SELECT 1 FROM runtime_observations WHERE identity_id=OLD.identity_id AND identity_id!=fact_id);
END;
CREATE TRIGGER runtime_query_update INSTEAD OF UPDATE OF query_file_offset,query_size,query_data,query_ready ON runtime BEGIN
 UPDATE runtime_observations SET query_file_offset=NEW.query_file_offset,query_size=NEW.query_size,
 query_data=NEW.query_data,query_ready=NEW.query_ready WHERE oid=OLD.rowid;
END;
-- Compatibility mutations detach one logical record. They must never change another capture's shared fact.
CREATE TRIGGER runtime_insert INSTEAD OF INSERT ON runtime BEGIN
 INSERT INTO runtime_identities(value) SELECT NEW.id WHERE NOT EXISTS(SELECT 1 FROM runtime_identities WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.id")}) AND value=NEW.id);
 INSERT INTO runtime_facts(kind,architecture,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,payload)
 VALUES(NEW.kind,NEW.architecture,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,
 CASE WHEN json_valid(NEW.payload) THEN jsonb(NEW.payload) ELSE NEW.payload END);
 -- Nested view inserts restore last_insert_rowid(). The single writer owns the new maximum fid.
 INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,query_file_offset,query_size,query_data,query_ready)
 VALUES((SELECT MAX(fid) FROM runtime_fact_rows),NEW.prefix_id,(SELECT iid FROM runtime_identities WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.id")}) AND value=NEW.id),NEW.evidence_id,NEW.count,NEW.query_file_offset,NEW.query_size,NEW.query_data,
 CASE WHEN NEW.kind='runtime-execution' THEN 0 ELSE 1 END);
END;
CREATE TRIGGER runtime_delete INSTEAD OF DELETE ON runtime BEGIN
 -- Deleting just the instruction preserves its independent logical state record.
 INSERT INTO runtime_facts(kind,architecture,address_space,address,payload)
 SELECT 'runtime-cpu-state',f.architecture,f.address_space,f.address,f.payload
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id WHERE o.oid=OLD.rowid AND o.state_prefix_id IS NOT NULL;
 INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,query_ready)
 SELECT (SELECT MAX(fid) FROM runtime_fact_rows),state_prefix_id,identity_id,evidence_id,count,1 FROM runtime_observations WHERE oid=OLD.rowid AND state_prefix_id IS NOT NULL;
 UPDATE runtime_observations SET state_prefix_id=NULL WHERE oid=-OLD.rowid;
 -- A preceding instruction deletion may have detached this virtual state; stable identity still finds it.
 DELETE FROM runtime_observations WHERE prefix_id=OLD.prefix_id AND identity_id=(SELECT iid FROM runtime_identities WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("OLD.id")}) AND value=OLD.id);
END;
CREATE TRIGGER runtime_record_update INSTEAD OF UPDATE OF prefix_id,id,kind,architecture,count,address_space,address,start,"end",
 from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
 accessed_address_space,accessed_address,coverage,evidence_id,payload ON runtime BEGIN
 DELETE FROM runtime WHERE prefix_id=OLD.prefix_id AND id=OLD.id;
 INSERT INTO runtime(prefix_id,id,kind,architecture,count,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,evidence_id,payload)
 VALUES(NEW.prefix_id,NEW.id,NEW.kind,NEW.architecture,NEW.count,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,NEW.evidence_id,NEW.payload);
END;
`;
function pairedState(payload) {
  const parsed = parseSqlitePayload(payload);
  if (!isRecord4(parsed)) {
    throw new Error("Invalid paired runtime payload.");
  }
  return parsed.state;
}
var SqliteRuntimeWriter = class {
  #findFact;
  #insertFact;
  #insertObservation;
  #pair;
  #findPair;
  #removeObservation;
  #findIdentity;
  #insertIdentity;
  constructor(db) {
    this.#findFact = db.prepare(
      "SELECT fid FROM runtime_fact_rows WHERE substr(fingerprint,1,8)=substr(?1,1,8) AND fingerprint=?1"
    );
    this.#insertFact = db.prepare(`INSERT INTO runtime_facts(fingerprint,kind,architecture,address_space,address,start,"end",
      from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
      accessed_address_space,accessed_address,coverage,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN typeof(?)='text' THEN jsonb(?) ELSE ? END)`);
    this.#insertObservation = db.prepare(
      "INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,state_prefix_id,query_ready) VALUES(?,?,?,?,?,?,?)"
    );
    this.#pair = db.prepare("UPDATE runtime_observations SET state_prefix_id=? WHERE oid=?");
    this.#findPair = db.prepare(`SELECT o.*,f.kind,f.architecture,f.address_space,f.address,CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
      FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?)
      AND o.identity_id=(SELECT iid FROM runtime_identities WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?2")}) AND value=?2)`);
    this.#removeObservation = db.prepare("DELETE FROM runtime_observations WHERE oid=?");
    this.#findIdentity = db.prepare(
      `SELECT iid FROM runtime_identities WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?1")}) AND value=?1`
    );
    this.#insertIdentity = db.prepare("INSERT INTO runtime_identities(value) VALUES(?)");
  }
  /** Append one validated logical record. Only exact trace pairs share a count/provenance link.
   * @param {RuntimeEvidenceRecord} record Validated source fact with a stable external ID.
   * @param {Function} intern Transaction-owned prefix/evidence dictionary allocator.
   */
  insert(record2, intern) {
    const identity = sqliteRuntimeIdentity(record2.id);
    const prefix = intern("runtime_prefixes", identity.prefix);
    const evidence = intern("runtime_evidence", JSON.stringify(record2.evidence));
    const columns2 = runtimeColumns(record2);
    let statePrefix = null;
    const match = /^runtime:instruction-trace:([\da-f]{64}):(code|state):([\da-f]{64})$/.exec(
      record2.id
    );
    if (match && (record2.kind === "runtime-instruction" || record2.kind === "runtime-cpu-state")) {
      const counterpart = match[2] === "code" ? "state" : "code";
      const otherIdentity = sqliteRuntimeIdentity(
        `runtime:instruction-trace:${match[1]}:${counterpart}:${match[3]}`
      );
      const other = this.#findPair.get(otherIdentity.prefix, otherIdentity.suffix);
      const expectedKind = record2.kind === "runtime-instruction" ? "runtime-cpu-state" : "runtime-instruction";
      if (other && other.kind === expectedKind && other.state_prefix_id === null && other.count === record2.count && other.evidence_id === evidence && other.architecture === record2.architecture && other.address_space === record2.addressSpace && other.address === record2.address && canonicalEquals(pairedState(other.payload), record2.state)) {
        if (record2.kind === "runtime-cpu-state") {
          this.#pair.run(prefix, other.oid);
          return;
        }
        statePrefix = Number(other.prefix_id);
        this.#removeObservation.run(other.oid);
      }
    }
    const payload = columns2.payload;
    const fingerprint = runtimeFactFingerprint(record2, columns2);
    const found = this.#findFact.get(fingerprint);
    let fid = found?.fid;
    if (fid === void 0) {
      const encoded = encodeRuntimeFactPayload(record2, payload);
      this.#insertFact.run(
        fingerprint,
        record2.kind,
        record2.architecture,
        columns2.addressSpace,
        columns2.address,
        columns2.start,
        columns2.end,
        columns2.fromAddressSpace,
        columns2.fromAddress,
        columns2.toAddressSpace,
        columns2.toAddress,
        columns2.instructionAddressSpace,
        columns2.instructionAddress,
        columns2.accessedAddressSpace,
        columns2.accessedAddress,
        columns2.coverage,
        encoded,
        encoded,
        encoded
      );
      fid = this.#findFact.get(fingerprint).fid;
    }
    const foundIdentity = this.#findIdentity.get(identity.suffix);
    const identityId = foundIdentity?.iid ?? this.#insertIdentity.run(identity.suffix).lastInsertRowid;
    this.#insertObservation.run(
      fid,
      prefix,
      identityId,
      evidence,
      record2.count,
      statePrefix,
      record2.kind === "runtime-execution" ? 0 : 1
    );
  }
};

// packages/disassembler/src/storage/sqlite-runtime-batch.ts
var RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL = `
  INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,state_prefix_id,query_ready)
    SELECT f.fid,b.prefix_id,i.iid,b.evidence_id,b.count,b.state_prefix_id,b.query_ready
    FROM temp.runtime_trace_batch b CROSS JOIN runtime_fact_rows f
      ON substr(f.fingerprint,1,8)=substr(b.fingerprint,1,8) AND f.fingerprint=b.fingerprint
    CROSS JOIN runtime_identities i
      ON (${runtimeIdentityKey("i.value")})=(${runtimeIdentityKey("b.identity_value")}) AND i.value=b.identity_value
    ORDER BY b.position
`;
function assertTraceRecordNamespace(record2, sourceSha256) {
  const root = `runtime:instruction-trace:${sourceSha256}:`;
  let prefix = root;
  if (record2.kind === "runtime-instruction") {
    prefix += "code:";
  } else if (record2.kind === "runtime-cpu-state") {
    prefix += "state:";
  } else if (record2.kind === "runtime-memory-access") {
    prefix += "memory:";
  } else if (record2.kind !== "runtime-execution") {
    throw new Error("Unsupported instruction trace batch record.");
  }
  const suffix = record2.id.slice(prefix.length);
  let validSuffix = /^[\da-f]{64}$/.test(suffix);
  if (record2.kind === "runtime-execution") {
    const pc = record2.address.toString(16).toUpperCase().padStart(6, "0");
    validSuffix = suffix === pc || record2.architecture === "65xx.2a03" && suffix.startsWith(`${pc}:mapping:`) && /^[\da-f]{64}$/.test(suffix.slice(pc.length + 9));
  }
  if (!record2.id.startsWith(prefix) || !validSuffix || !canonicalEquals(record2.evidence, [root.slice(0, -1)])) {
    throw new Error("Runtime record escaped its trace batch namespace or provenance.");
  }
}
var SqliteRuntimeTraceBatch = class {
  #db;
  #source;
  #intern;
  #stage;
  #pending;
  #rows = 0;
  #finished = false;
  constructor(db, source, intern) {
    this.#db = db;
    this.#source = source;
    this.#intern = intern;
    db.exec(`CREATE TEMP TABLE runtime_trace_batch (
      position INTEGER PRIMARY KEY, fingerprint BLOB NOT NULL,
      ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",")},
      payload, prefix_id INTEGER NOT NULL, identity_value NOT NULL,
      evidence_id INTEGER NOT NULL, count INTEGER NOT NULL, state_prefix_id INTEGER, query_ready INTEGER NOT NULL
    )`);
    this.#stage = db.prepare(
      `INSERT INTO temp.runtime_trace_batch VALUES (${Array(24).fill("?").join(",")})`
    );
  }
  /** Accept only the importer's adjacent code/state pairs; validate equality before sharing storage. */
  add(record2) {
    if (this.#finished || !this.#db.isTransaction) {
      throw new Error("Runtime trace batch is no longer active.");
    }
    assertTraceRecordNamespace(record2, this.#source);
    if (this.#pending) {
      const instruction = this.#pending;
      if (record2.kind !== "runtime-cpu-state" || record2.id !== instruction.id.replace(":code:", ":state:") || record2.architecture !== instruction.architecture || record2.addressSpace !== instruction.addressSpace || record2.address !== instruction.address || record2.count !== instruction.count || !canonicalEquals(record2.state, instruction.state)) {
        throw new Error("Instruction trace batch has an inconsistent code/state pair.");
      }
      this.#pending = void 0;
      this.#append(
        instruction,
        this.#intern("runtime_prefixes", sqliteRuntimeIdentity(record2.id).prefix)
      );
    } else if (record2.kind === "runtime-instruction") {
      this.#pending = record2;
    } else if (record2.kind === "runtime-cpu-state") {
      throw new Error("Instruction trace batch state has no preceding instruction.");
    } else {
      this.#append(record2, null);
    }
    return true;
  }
  /** Encode once per physical observation; repeated shared facts are resolved together in SQL. */
  #append(record2, statePrefix) {
    const columns2 = runtimeColumns(record2);
    const identity = sqliteRuntimeIdentity(record2.id);
    this.#stage.run(
      ++this.#rows,
      runtimeFactFingerprint(record2, columns2),
      record2.kind,
      record2.architecture,
      columns2.addressSpace,
      columns2.address,
      columns2.start,
      columns2.end,
      columns2.fromAddressSpace,
      columns2.fromAddress,
      columns2.toAddressSpace,
      columns2.toAddress,
      columns2.instructionAddressSpace,
      columns2.instructionAddress,
      columns2.accessedAddressSpace,
      columns2.accessedAddress,
      columns2.coverage,
      encodeRuntimeFactPayload(record2, columns2.payload),
      this.#intern("runtime_prefixes", identity.prefix),
      identity.suffix,
      this.#intern("runtime_evidence", JSON.stringify(record2.evidence)),
      record2.count,
      statePrefix,
      record2.kind === "runtime-execution" ? 0 : 1
    );
    if (this.#rows >= 1024) {
      this.#flush();
    }
  }
  /** Full hash/value equality follows each compact index key; collisions never merge distinct facts. */
  #flush() {
    if (!this.#rows) {
      return;
    }
    const columns2 = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",");
    const selected = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `b."${column}"`).join(",");
    this.#db.exec(`
      INSERT INTO runtime_facts(fingerprint,${columns2},payload)
        SELECT DISTINCT b.fingerprint,${selected},CASE WHEN typeof(b.payload)='text' THEN jsonb(b.payload) ELSE b.payload END
        FROM temp.runtime_trace_batch b WHERE NOT EXISTS (
          SELECT 1 FROM runtime_fact_rows f
          WHERE substr(f.fingerprint,1,8)=substr(b.fingerprint,1,8) AND f.fingerprint=b.fingerprint
        );
      INSERT INTO runtime_identities(value)
        SELECT DISTINCT b.identity_value FROM temp.runtime_trace_batch b WHERE NOT EXISTS (
          SELECT 1 FROM runtime_identities i
          WHERE (${runtimeIdentityKey("i.value")})=(${runtimeIdentityKey("b.identity_value")}) AND i.value=b.identity_value
        );
      ${RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL};
      DELETE FROM temp.runtime_trace_batch;
    `);
    this.#rows = 0;
  }
  finish() {
    if (this.#finished || !this.#db.isTransaction) {
      throw new Error("Runtime trace batch is no longer active.");
    }
    if (this.#pending) {
      throw new Error("Instruction trace batch ended without its paired state.");
    }
    this.#flush();
    this.#db.exec("DROP TABLE temp.runtime_trace_batch");
    this.#finished = true;
  }
};

// packages/disassembler/src/storage/sqlite-runtime-summary.ts
var import_node_crypto3 = require("node:crypto");
var KEY = "instruction_variants";
var BUILD = "instruction_variants_build";
var INVALIDATE = `DELETE FROM query_cache WHERE name IN ('${KEY}','${BUILD}');`;
var RUNTIME_SUMMARY_ROWS_SQL = `SELECT i.value AS id,f.kind,f.architecture,f.address_space,f.address,
    grouped.total AS count,CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload,
    p.value AS id_prefix,e.value AS evidence
  FROM (SELECT s.sample,s.total FROM query_runtime_variant_sources s
    JOIN query_runtime_variant_keys k ON k.id=s.variant
    ORDER BY k.address,s.evidence,k.key LIMIT -1) grouped
  CROSS JOIN runtime_observations o ON o.oid=grouped.sample
  CROSS JOIN runtime_facts f ON f.fid=o.fact_id
  LEFT JOIN runtime_identities i ON i.iid=o.identity_id
  LEFT JOIN runtime_prefixes p ON p.id=o.prefix_id
  LEFT JOIN runtime_evidence e ON e.id=o.evidence_id`;
var installSummary = (db) => {
  installQueryCache(db, KEY, []);
  db.exec(`${INVALIDATE}
    CREATE TABLE query_runtime_variant_keys(
      id INTEGER PRIMARY KEY,address INTEGER NOT NULL,key TEXT NOT NULL,UNIQUE(address,key));
    CREATE TABLE query_runtime_variant_sources(
      variant INTEGER NOT NULL,evidence INTEGER NOT NULL,total INTEGER NOT NULL,
      observations INTEGER NOT NULL,sample INTEGER NOT NULL,
      PRIMARY KEY(variant,evidence)) WITHOUT ROWID;
    CREATE TABLE query_runtime_variant_pending(oid INTEGER PRIMARY KEY);
    CREATE TRIGGER summary_observation_insert AFTER INSERT ON runtime_observations BEGIN
      DELETE FROM query_cache WHERE name='${BUILD}';
      INSERT OR IGNORE INTO query_runtime_variant_pending
        SELECT NEW.oid WHERE EXISTS(SELECT 1 FROM query_cache WHERE name='${KEY}')
        AND EXISTS(SELECT 1 FROM runtime_fact_locations WHERE fid=NEW.fact_id AND kind='runtime-instruction');
    END;
    CREATE TRIGGER summary_observation_update AFTER UPDATE OF
      oid,fact_id,prefix_id,identity_id,evidence_id,count ON runtime_observations
      WHEN OLD.oid IS NOT NEW.oid OR OLD.fact_id IS NOT NEW.fact_id
        OR OLD.prefix_id IS NOT NEW.prefix_id OR OLD.identity_id IS NOT NEW.identity_id
        OR OLD.evidence_id IS NOT NEW.evidence_id OR OLD.count IS NOT NEW.count
      BEGIN ${INVALIDATE} END;
    CREATE TRIGGER summary_observation_delete AFTER DELETE ON runtime_observations
      BEGIN ${INVALIDATE} END;
    CREATE TRIGGER summary_observation_replace BEFORE INSERT ON runtime_observations
      WHEN EXISTS(SELECT 1 FROM query_cache WHERE name IN ('${KEY}','${BUILD}')) AND (
        EXISTS(SELECT 1 FROM runtime_observations WHERE oid=NEW.oid) OR
        EXISTS(SELECT 1 FROM runtime_observations WHERE prefix_id=NEW.prefix_id AND identity_id=NEW.identity_id) OR
        EXISTS(SELECT 1 FROM runtime_observations WHERE state_prefix_id=NEW.state_prefix_id AND identity_id=NEW.identity_id))
      BEGIN ${INVALIDATE} END;`);
  for (const [table, primary, unique2] of [
    ["runtime_fact_rows", "fid", "fingerprint"],
    ["runtime_identities", "iid", "value"],
    ["runtime_prefixes", "id", "value"],
    ["runtime_evidence", "id", "value"]
  ]) {
    const condition = table === "runtime_fact_rows" ? "WHEN OLD.fid IS NOT NEW.fid OR OLD.fingerprint IS NOT NEW.fingerprint OR OLD.descriptor_id IS NOT NEW.descriptor_id OR NEW.history_id IS NULL" : "";
    let uniqueMatch = `${unique2}=NEW.${unique2}`;
    if (table === "runtime_fact_rows") {
      uniqueMatch = `substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8) AND ${uniqueMatch}`;
    } else if (table === "runtime_identities") {
      uniqueMatch = `(${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND ${uniqueMatch}`;
    }
    db.exec(`CREATE TRIGGER summary_${table}_replace BEFORE INSERT ON ${table}
      WHEN EXISTS(SELECT 1 FROM query_cache WHERE name IN ('${KEY}','${BUILD}')) AND (
        EXISTS(SELECT 1 FROM ${table} WHERE ${primary}=NEW.${primary}) OR
        EXISTS(SELECT 1 FROM ${table} WHERE ${uniqueMatch}))
      BEGIN ${INVALIDATE} END;
      CREATE TRIGGER summary_${table}_update AFTER UPDATE ON ${table} ${condition} BEGIN ${INVALIDATE} END;
      CREATE TRIGGER summary_${table}_delete AFTER DELETE ON ${table} BEGIN ${INVALIDATE} END;`);
  }
};
var runtimeSummaryInputSql = (incremental) => {
  const from = incremental ? `query_runtime_variant_pending pending
      CROSS JOIN runtime_observations o ON o.oid=pending.oid
      CROSS JOIN runtime_facts f ON f.fid=o.fact_id` : (
    // The address index visits the same compressed history blocks repeatedly, once per observed PC.
    // A sequential physical scan trades coordinate filtering for bounded, reusable decoder buffers;
    // payload decoding still happens only after the architecture/kind predicate. Appends stay indexed.
    "runtime_observations o NOT INDEXED CROSS JOIN runtime_facts f ON f.fid=o.fact_id"
  );
  return `SELECT f.address,analysis_instruction_variant(
      CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END) AS key,
      o.evidence_id AS evidence,o.count AS total,o.oid AS sample
    FROM ${from}
    WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=?`;
};
var registerVariantKey = (db, fields, masks) => {
  db.function("analysis_instruction_variant", { deterministic: true }, (payload) => {
    const record2 = parseSqlitePayload(payload);
    if (!isRecord4(record2) || !isByteList(record2.bytes) || !isRecord4(record2.state)) {
      throw new Error("Invalid instruction variant payload.");
    }
    const state = {};
    for (const key3 of fields) {
      const value = record2.state[key3];
      const mask = masks[key3];
      if (mask && typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= mask.max) {
        state[key3] = value & mask.mask;
      } else if (value !== void 0) {
        state[key3] = value;
      }
    }
    return JSON.stringify([record2.bytes, state]);
  });
};
function isByteList(value) {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
var isCurrent = (db, signature) => readQueryCache(db, KEY, signature) !== void 0 && !db.prepare("SELECT 1 FROM query_runtime_variant_pending LIMIT 1").get();
var runtimeInstructionSummary = (db, transaction, architecture, space, fields, masks, onProgress) => {
  if (fields.some((field) => !/^\w+$/.test(field))) {
    throw new Error("Invalid instruction state field.");
  }
  const signature = JSON.stringify([4, architecture, space, fields, masks]);
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_runtime_variant_keys'").get()) {
    transaction(() => {
      if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_runtime_variant_keys'").get()) {
        installSummary(db);
      }
    });
  }
  if (!isCurrent(db, signature)) {
    const pending = `pending:${(0, import_node_crypto3.randomUUID)()}`;
    let incremental = false;
    transaction(() => {
      incremental = readQueryCache(db, KEY, signature) !== void 0;
      writeQueryCache(db, BUILD, pending, null);
    });
    let completed = false;
    let cleanupError;
    try {
      registerVariantKey(db, fields, masks);
      transaction(() => {
        db.exec(`CREATE TEMP TABLE runtime_summary_groups(
          address INTEGER NOT NULL,key TEXT NOT NULL,evidence INTEGER NOT NULL,
          total INTEGER NOT NULL,observations INTEGER NOT NULL,sample INTEGER NOT NULL,
          PRIMARY KEY(address,key,evidence)) WITHOUT ROWID`);
        const accumulate = db.prepare(`INSERT INTO temp.runtime_summary_groups
          VALUES(?,?,?,?,1,?) ON CONFLICT(address,key,evidence) DO UPDATE SET
          total=total+excluded.total,observations=observations+1,sample=MIN(sample,excluded.sample)`);
        const source = incremental ? "query_runtime_variant_pending p CROSS JOIN runtime_observations o ON o.oid=p.oid" : "runtime_observations o NOT INDEXED";
        const totalObservations = Number(
          db.prepare(`SELECT count(*) AS n FROM ${source}
          CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
          WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=?`).get(architecture, space).n
        );
        let observations = 0;
        for (const row of db.prepare(runtimeSummaryInputSql(incremental)).iterate(architecture, space)) {
          accumulate.run(row.address, row.key, row.evidence, row.total, row.sample);
          observations++;
          if (observations % 4096 === 0) {
            onProgress?.(observations, totalObservations);
          }
        }
        onProgress?.(observations, totalObservations);
      }, false);
      transaction(() => {
        if (db.prepare("SELECT signature FROM query_cache WHERE name=?").get(BUILD)?.signature !== pending) {
          throw new Error("Runtime changed while building instruction variants. Retry reanalysis.");
        }
        if (!incremental) {
          db.exec(
            "DELETE FROM query_runtime_variant_sources; DELETE FROM query_runtime_variant_keys;"
          );
        }
        db.exec(`INSERT OR IGNORE INTO query_runtime_variant_keys(address,key)
          SELECT address,key FROM temp.runtime_summary_groups;
          INSERT INTO query_runtime_variant_sources
            SELECT k.id,g.evidence,g.total,g.observations,g.sample FROM temp.runtime_summary_groups g
            JOIN query_runtime_variant_keys k ON k.address=g.address AND k.key=g.key WHERE true
          ON CONFLICT(variant,evidence) DO UPDATE SET
            total=total+excluded.total,observations=observations+excluded.observations,
            sample=MIN(sample,excluded.sample);
          DELETE FROM query_runtime_variant_pending;`);
        const observations = Number(
          db.prepare("SELECT COALESCE(SUM(observations),0) AS n FROM temp.runtime_summary_groups").get().n
        );
        writeQueryCache(db, KEY, signature, { incremental, observations });
        db.prepare("DELETE FROM query_cache WHERE name=?").run(BUILD);
      });
      completed = true;
    } finally {
      try {
        db.exec("DROP TABLE IF EXISTS temp.runtime_summary_groups");
        transaction(() => {
          db.prepare("DELETE FROM query_cache WHERE name=? AND signature=?").run(BUILD, pending);
        });
      } catch (error) {
        if (completed) {
          cleanupError = error instanceof Error ? error : new Error("Instruction summary cleanup failed.", { cause: error });
        }
      }
    }
    if (cleanupError !== void 0) {
      throw cleanupError;
    }
  }
  return (function* () {
    if (!isCurrent(db, signature)) {
      throw new Error("Runtime changed before reading instruction variants. Retry reanalysis.");
    }
    const rows = db.prepare(RUNTIME_SUMMARY_ROWS_SQL);
    for (const row of rows.iterate()) {
      const record2 = runtimeFromRow(row);
      if (record2.kind !== "runtime-instruction") {
        throw new Error("Invalid instruction summary representative.");
      }
      yield {
        ...record2,
        state: Object.fromEntries(
          Object.entries(record2.state).filter(([key3]) => fields.includes(key3))
        )
      };
    }
  })();
};

// packages/disassembler/src/storage/sqlite-source-query.ts
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray2(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function optionalString(record2, key3) {
  if (!Object.hasOwn(record2, key3)) {
    return void 0;
  }
  const value = record2[key3];
  if (typeof value !== "string") {
    throw new Error("Invalid source metadata record.");
  }
  return value;
}
function optionalNumber(record2, key3) {
  if (!Object.hasOwn(record2, key3)) {
    return void 0;
  }
  const value = record2[key3];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid source metadata record.");
  }
  return value;
}
var collections = ["labels", "comments", "annotations", "regions"];
var sourceEvidence = `WITH source_evidence AS (
  SELECT DISTINCT e.id FROM runtime_evidence e, json_each(e.value) member
  WHERE member.value IN (SELECT value FROM json_each(?)))`;
var sourceRuntime = "r.evidence_id IN (SELECT id FROM source_evidence)";
var sourceObservations = "o.evidence_id IN (SELECT id FROM source_evidence)";
var instructionKinds = "f.kind IN ('runtime-execution','runtime-instruction')";
var observationLocations = "runtime_observations o JOIN runtime_fact_locations f ON f.fid=o.fact_id";
var hex = (address) => `$${address.toString(16).toUpperCase().padStart(6, "0")}`;
var sourceQueriesReady = (db) => Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) && !db.prepare("SELECT 1 FROM query_source_rows WHERE ready=0 LIMIT 1").get();
var prepareSourceQueries = (db) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) {
    db.exec(`CREATE INDEX IF NOT EXISTS runtime_source ON runtime_observations(evidence_id,fact_id);
      CREATE TABLE query_source_rows(collection TEXT NOT NULL,id TEXT NOT NULL,ready INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_pending ON query_source_rows(ready) WHERE ready=0;
      CREATE TABLE query_source_links(evidence_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(evidence_id,collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_record ON query_source_links(collection,id);`);
    for (const table of collections) {
      db.exec(`INSERT INTO query_source_rows(collection,id) SELECT '${table}',id FROM ${table};
        CREATE TRIGGER query_source_${table}_insert AFTER INSERT ON ${table} BEGIN
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;
        CREATE TRIGGER query_source_${table}_delete AFTER DELETE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id; END;
        CREATE TRIGGER query_source_${table}_update AFTER UPDATE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id;
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;`);
    }
  }
  const remove = db.prepare("DELETE FROM query_source_links WHERE collection=? AND id=?");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO query_source_links(evidence_id,collection,id) VALUES(?,?,?)"
  );
  const ready = db.prepare("UPDATE query_source_rows SET ready=1 WHERE collection=? AND id=?");
  for (const table of collections) {
    const pending = db.prepare(
      `SELECT q.id,t.payload FROM query_source_rows q JOIN ${table} t ON t.id=q.id WHERE q.collection=? AND q.ready=0 LIMIT 1024`
    );
    for (let rows = pending.all(table); rows.length; rows = pending.all(table)) {
      for (const row of rows) {
        const parsed = JSON.parse(decodeSqlitePayload(row.payload));
        if (!isRecord8(parsed) || !isStringArray2(parsed.evidence)) {
          throw new Error("Invalid source metadata evidence membership.");
        }
        remove.run(table, row.id);
        for (const id of parsed.evidence) {
          insert.run(id, table, row.id);
        }
        ready.run(table, row.id);
      }
    }
  }
};
var readSourceSummary = (db, source) => {
  const evidence = JSON.stringify(source.evidenceIds);
  const instructionCount = Number(
    db.prepare(`${sourceEvidence} SELECT count(*) AS n FROM (
    SELECT f.architecture,f.address_space,f.address FROM ${observationLocations}
    WHERE ${sourceObservations} AND ${instructionKinds}
    GROUP BY f.architecture,f.address_space,f.address)`).get(evidence)?.n ?? 0
  );
  const memoryCount = Number(
    db.prepare(`${sourceEvidence} SELECT count(*) AS n FROM ${observationLocations}
    WHERE ${sourceObservations} AND f.kind='runtime-memory-access'`).get(evidence)?.n ?? 0
  );
  const contributionCount = Number(
    db.prepare(`SELECT count(*) AS n FROM (
    SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))`).get(evidence)?.n ?? 0
  );
  return { source, instructionCount, memoryCount, contributionCount };
};
var readSourcePage = (db, source, group, offset = 0) => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid source page offset.");
  }
  const evidence = JSON.stringify(source.evidenceIds);
  if (group === "instructions") {
    const rows = db.prepare(`${sourceEvidence} SELECT f.architecture,f.address_space,f.address,
      SUM(CASE WHEN f.kind='runtime-execution' THEN o.count ELSE 0 END) AS executions
      FROM ${observationLocations} WHERE ${sourceObservations} AND ${instructionKinds}
      GROUP BY f.architecture,f.address_space,f.address ORDER BY f.architecture,f.address_space,f.address LIMIT 200 OFFSET ?`).all(evidence, offset);
    const offsets = db.prepare(`${sourceEvidence} SELECT DISTINCT o.query_file_offset AS file_offset
      FROM runtime_fact_locations f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE ${sourceObservations} AND f.kind='runtime-execution'
      AND f.architecture=? AND f.address_space=? AND f.address=?
      AND o.query_file_offset IS NOT NULL ORDER BY o.query_file_offset`);
    return rows.map((row) => ({
      id: JSON.stringify([row.architecture, row.address_space, row.address]),
      label: hex(Number(row.address)),
      description: `${String(row.executions)} recorded executions`,
      detail: "Directly observed instruction address. CPU-state variants do not inflate the address count. Execution counts exclude duplicate fetched-instruction facts.",
      architecture: String(row.architecture),
      addressSpace: String(row.address_space),
      address: Number(row.address),
      outputOffsets: offsets.all(evidence, row.architecture, row.address_space, row.address).map((entry) => Number(entry.file_offset)),
      recordIds: []
    }));
  }
  if (group === "memory") {
    return db.prepare(`${sourceEvidence} SELECT r.*,p.value AS id_prefix,e.value AS evidence
      FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE ${sourceRuntime} AND r.kind='runtime-memory-access' ORDER BY r.evidence_id,r.kind,r.rowid LIMIT 200 OFFSET ?`).all(evidence, offset).map((row) => {
      const record2 = runtimeFromRow(row);
      if (record2.kind !== "runtime-memory-access") {
        throw new Error("Invalid memory observation.");
      }
      const detail = `${record2.access} ${record2.accessedAddressSpace}:${hex(record2.accessedAddress)} \xB7 ${record2.width} byte(s) \xB7 ${record2.count} observations`;
      return {
        id: record2.id,
        label: hex(record2.instructionAddress),
        description: detail,
        detail,
        architecture: record2.architecture,
        addressSpace: record2.instructionAddressSpace,
        address: record2.instructionAddress,
        outputOffsets: [],
        recordIds: [record2.id]
      };
    });
  }
  const select = collections.map(
    (table) => `SELECT '${table}' AS collection,t.id AS id,t.payload AS payload FROM ${table} t JOIN matched m ON m.collection='${table}' AND m.id=t.id`
  ).join(" UNION ALL ");
  return db.prepare(`WITH matched AS (SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))
    ${select} ORDER BY collection,id LIMIT 200 OFFSET ?`).all(evidence, offset).map((row) => {
    const parsed = JSON.parse(decodeSqlitePayload(row.payload));
    if (!isRecord8(parsed) || typeof parsed.id !== "string") {
      throw new Error("Invalid source metadata record.");
    }
    const addressSpace = optionalString(parsed, "addressSpace");
    if (addressSpace === void 0) {
      throw new Error("Invalid source metadata record.");
    }
    const address = optionalNumber(parsed, "address") ?? optionalNumber(parsed, "start");
    const label = optionalString(parsed, "name") ?? optionalString(parsed, "text") ?? optionalString(parsed, "classification") ?? parsed.id;
    return {
      id: `${String(row.collection)}:${parsed.id}`,
      label,
      description: String(row.collection),
      detail: `Attributed to ${source.name}: ${parsed.id}`,
      addressSpace,
      address,
      architecture: optionalString(parsed, "architecture"),
      outputOffsets: [],
      recordIds: [parsed.id]
    };
  });
};

// packages/disassembler/src/storage/sqlite-storage-policy.ts
var import_node_fs3 = __toESM(require("node:fs"), 1);
function errorCode(error) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return void 0;
}
var DEFAULT_ANALYSIS_STORAGE_POLICY = {
  cacheMaxBytes: 256 * 1024 ** 2,
  databaseMaxBytes: 0
};
var CAPTURE_CATALOG_SCHEMA = `CREATE TABLE capture_catalog (
  sha256 TEXT PRIMARY KEY, profile TEXT NOT NULL, source_name TEXT NOT NULL,
  imported_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  observed_events INTEGER NOT NULL, dropped_events INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;`;
function isSafeInteger5(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isPolicyRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var readStoragePolicy = (db) => {
  const value = db.prepare("SELECT v FROM meta WHERE k='storage-policy'").get()?.v;
  return validateStoragePolicy(value ? JSON.parse(String(value)) : {});
};
var validateStoragePolicy = (value) => {
  if (!isPolicyRecord(value)) {
    throw new Error("Storage policy must be an object containing explicit limits.");
  }
  let cacheMaxBytes = DEFAULT_ANALYSIS_STORAGE_POLICY.cacheMaxBytes;
  let databaseMaxBytes = DEFAULT_ANALYSIS_STORAGE_POLICY.databaseMaxBytes;
  for (const [key3, count] of Object.entries(value)) {
    if (!Object.hasOwn(DEFAULT_ANALYSIS_STORAGE_POLICY, key3) || !(isSafeInteger5(count) && count >= 0)) {
      throw new Error(`Invalid storage limit '${key3}'. Use nonnegative integer byte limits.`);
    }
    if (key3 === "cacheMaxBytes") {
      cacheMaxBytes = count;
    } else if (key3 === "databaseMaxBytes") {
      databaseMaxBytes = count;
    }
  }
  return { cacheMaxBytes, databaseMaxBytes };
};
var storageSnapshot = (db, file) => {
  const size = Number(db.prepare("PRAGMA page_size").get().page_size);
  const pages = Number(db.prepare("PRAGMA page_count").get().page_count);
  const free = Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
  const rows = db.prepare("SELECT COUNT(*) AS n,COUNT(state_prefix_id) AS paired FROM runtime_observations").get();
  const captures = db.prepare("SELECT COUNT(*) AS n FROM capture_catalog").get();
  let walBytes = 0;
  try {
    walBytes = import_node_fs3.default.statSync(`${file}-wal`).size;
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error;
    }
  }
  return {
    databaseBytes: import_node_fs3.default.statSync(file).size,
    walBytes,
    livePageBytes: (pages - free) * size,
    freePageBytes: free * size,
    // Count the owning rows directly; the logical view would join every shared descriptor.
    facts: Number(db.prepare("SELECT COUNT(*) AS n FROM runtime_fact_rows").get().n),
    observations: Number(rows.n),
    pairedStates: Number(rows.paired),
    captures: Number(captures.n)
  };
};
var enforceDatabaseBudget = (db) => {
  const budget = readStoragePolicy(db).databaseMaxBytes;
  if (!budget) {
    return;
  }
  const pages = Number(db.prepare("PRAGMA page_count").get().page_count) - Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
  const bytes = pages * Number(db.prepare("PRAGMA page_size").get().page_size);
  if (bytes > budget) {
    throw new Error(
      `Analysis database exceeds its ${Math.ceil(budget / 1024 ** 2)} MiB storage budget. Publication rolled back. Increase the budget or run storage maintenance.`
    );
  }
};
var CACHES = [
  { key: "coverage", tables: ["query_coverage_segments", "query_coverage_details"] },
  { key: "graph", tables: ["query_graph_nodes", "query_graph_edges"] },
  {
    key: "instruction_variants",
    tables: [
      "query_runtime_variant_keys",
      "query_runtime_variant_sources",
      "query_runtime_variant_pending"
    ]
  },
  { key: "evidence_links", tables: ["query_evidence_links"] }
];
var RETIRED_CACHES = [
  { key: "snes_roles", tables: [] },
  { key: "runtime_architectures", tables: ["query_runtime_architectures"] }
];
var retireStorageCaches = (db) => {
  const removed = [];
  const dependencies = [
    "analysis",
    "annotations",
    "labels",
    "comments",
    "regions",
    "imports",
    "evidence",
    "runtime_fact_rows",
    "runtime_observations",
    "runtime_identities"
  ];
  for (const cache of RETIRED_CACHES) {
    let found = Boolean(db.prepare("SELECT 1 FROM query_cache WHERE name=?").get(cache.key));
    for (const table of dependencies) {
      for (const event of ["INSERT", "UPDATE", "DELETE"]) {
        const name2 = `cache_${cache.key}_${table}_${event}`;
        found ||= Boolean(
          db.prepare("SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name=?").get(name2)
        );
        db.exec(`DROP TRIGGER IF EXISTS ${name2}`);
      }
    }
    for (const table of cache.tables) {
      found ||= Boolean(
        db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table)
      );
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    db.prepare("DELETE FROM query_cache WHERE name=?").run(cache.key);
    if (found) {
      removed.push(cache.key);
    }
  }
  return removed;
};
var cacheTableBytes = (db, table) => {
  const allocation = db.prepare("SELECT COALESCE(SUM(pgsize),0) AS bytes FROM dbstat WHERE name=?");
  return db.prepare("SELECT name FROM sqlite_schema WHERE tbl_name=? AND type IN ('table','index')").all(table).reduce((bytes, row) => bytes + Number(allocation.get(row.name).bytes), 0);
};
var optionalCacheBytes = (db) => [...CACHES, ...RETIRED_CACHES].reduce(
  (bytes, cache) => bytes + cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0),
  cacheTableBytes(db, "query_cache")
);
var maintainStorageCaches = (db) => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return { evicted: [], cacheBytes: 0 };
  }
  const budget = readStoragePolicy(db).cacheMaxBytes;
  const evicted = retireStorageCaches(db);
  const entries = CACHES.map(
    (cache) => Object.assign({}, cache, {
      bytes: cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0)
    })
  );
  let cacheBytes = entries.reduce((n, cache) => n + cache.bytes, 0) + cacheTableBytes(db, "query_cache");
  for (const cache of entries) {
    const token = db.prepare("SELECT signature FROM query_cache WHERE name=?").get(cache.key);
    const summaryBuilder = cache.key === "instruction_variants" && db.prepare("SELECT 1 FROM query_cache WHERE name='instruction_variants_build'").get();
    if (summaryBuilder) {
      continue;
    }
    if (String(token?.signature).startsWith("pending:")) {
      continue;
    }
    if (token && cacheBytes <= budget) {
      continue;
    }
    for (const table of cache.tables) {
      if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table)) {
        db.exec(`DELETE FROM ${table}`);
      }
    }
    db.prepare("DELETE FROM query_cache WHERE name=?").run(cache.key);
    if (cache.bytes) {
      evicted.push(cache.key);
    }
    cacheBytes -= cache.bytes;
  }
  return { evicted, cacheBytes: optionalCacheBytes(db) };
};

// packages/disassembler/src/storage/sqlite-store.ts
var ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
var ANALYSIS_SQLITE_STORAGE_VERSION = 4;
var SCHEMA2 = `
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
${RUNTIME_STORAGE_SCHEMA}
${CAPTURE_CATALOG_SCHEMA}
PRAGMA user_version=4;
`;
var SCHEMA_INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS labels_addr ON labels (address_space, address)",
  "CREATE INDEX IF NOT EXISTS comments_addr ON comments (address_space, address)",
  'CREATE INDEX IF NOT EXISTS regions_range ON regions (address_space, start, "end")',
  'CREATE INDEX IF NOT EXISTS annotations_range ON annotations (address_space, start, "end")',
  // Point lookups through the virtual-state branch need an index on its exposed negative ID.
  "CREATE INDEX IF NOT EXISTS runtime_state_row ON runtime_observations((-oid)) WHERE state_prefix_id IS NOT NULL"
];
var RUNTIME_SELECT = `SELECT r.*, r.rowid AS storage_rowid, p.value AS id_prefix, e.value AS evidence
  FROM runtime AS r LEFT JOIN runtime_prefixes AS p ON p.id=r.prefix_id
  LEFT JOIN runtime_evidence AS e ON e.id=r.evidence_id`;
var RUNTIME_RECORD_LOOKUP_SQL = `${RUNTIME_SELECT} WHERE r.rowid IN (
  SELECT oid FROM runtime_observations
  WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?1)
    AND identity_id=(SELECT iid FROM runtime_identities
      WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?2")}) AND value=?2)
  UNION ALL
  SELECT -oid FROM runtime_observations
  WHERE state_prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?1)
    AND identity_id=(SELECT iid FROM runtime_identities
      WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("?2")}) AND value=?2)
)`;
var analysisProjectSqlitePath = (directory, manifest) => {
  const relative = manifest.db ?? ANALYSIS_PROJECT_SQLITE_FILE;
  if (relative !== ANALYSIS_PROJECT_SQLITE_FILE) {
    throw new Error(`Unsupported analysis sqlite path '${relative}'.`);
  }
  return import_node_path4.default.join(directory, relative);
};
var parseRecord = (payload) => parseSqlitePayload(payload);
function isByteList2(value) {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
function isRuntimeState2(value) {
  return isRecord4(value) && Object.values(value).every(
    (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry)
  );
}
function requireTraceFact(value) {
  if (!isRecord4(value)) {
    throw new Error("Invalid indexed trace fact.");
  }
  if (value.kind === "execution" && isFiniteNumber(value.address)) {
    if (value.identity !== void 0 && (typeof value.identity !== "string" || !/^[\da-f]{64}$/.test(value.identity))) {
      throw new Error("Invalid indexed execution mapping identity.");
    }
    return {
      kind: "execution",
      address: value.address,
      ...value.identity === void 0 ? {} : { identity: value.identity }
    };
  }
  if (value.kind === "instruction" && typeof value.identity === "string" && isFiniteNumber(value.address) && isByteList2(value.bytes) && isRuntimeState2(value.state)) {
    return {
      kind: "instruction",
      identity: value.identity,
      address: value.address,
      bytes: value.bytes,
      state: value.state
    };
  }
  if (value.kind === "memory" && isRuntimeEvidenceRecord(value.record)) {
    return { kind: "memory", record: value.record };
  }
  throw new Error("Invalid indexed trace fact.");
}
function isShardKind(value) {
  return value === "analysis" || value === "annotations" || value === "labels" || value === "comments" || value === "regions" || value === "runtime" || value === "evidence" || value === "imports";
}
function isResearchUpdate(value) {
  return value === "analysis" || value === "annotations" || value === "comments" || value === "evidence";
}
function observedImportCount(counts, key3) {
  return Object.hasOwn(counts, key3) ? counts[key3] : void 0;
}
function isSafeInteger6(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isObjectRecord(value) {
  return typeof value === "object" && value !== null;
}
function isIndexedExportInstruction(value, spaces, knownEvidence) {
  if (!isObjectRecord(value)) {
    return false;
  }
  const address = value.address;
  const addressSpace = value.addressSpace;
  const size = value.size;
  const opcode = value.opcode;
  const incomingState = value.incomingState;
  const evidenceList = value.evidence;
  return typeof value.id === "string" && value.id !== "" && typeof addressSpace === "string" && isSafeInteger6(address) && address >= 0 && address < (spaces.get(addressSpace) ?? 0) && isSafeInteger6(size) && size >= 1 && isSafeInteger6(opcode) && typeof value.specificationId === "string" && typeof incomingState === "object" && incomingState !== null && Array.isArray(evidenceList) && evidenceList.every((id) => typeof id === "string" && knownEvidence.has(id));
}
var sqliteFileIdentity = (file) => {
  const stat = import_node_fs4.default.statSync(file, { bigint: true });
  return `${stat.dev}:${stat.ino}`;
};
var SqliteAnalysisStore = class {
  #database;
  #fileIdentity;
  /** Block cache is owned by this connection and reset on commit, rollback, and snapshot entry. */
  #clearHistory;
  /** Database path as supplied at construction. Resolves relative to cwd when not absolute. */
  file;
  #insertEvidence;
  #insertLabel;
  #insertComment;
  #insertRegion;
  #insertAnnotation;
  #insertAnalysis;
  #insertImport;
  #runtimeWriter;
  #findRuntime;
  #dictionaryStatements = /* @__PURE__ */ new Map();
  /** Transaction-local cache: rollback or another writer cannot leave stale integer references here. */
  #dictionaryIds = /* @__PURE__ */ new Map();
  #dictionaryCacheBytes = 0;
  /** An import must restore Git decisions in the same transaction before exposing observations. */
  #researchSuspended = false;
  /**
   * Opens or creates a project database.
   * Opening validates physical format, not every semantic record, and may create SQLite journal files.
   * Connections use a 5,000 ms busy timeout. Lock contention can still throw a SQLite error.
   * @param {string} file SQLite path. Parent directory must already exist.
   * @param {boolean} [createSchema] Defaults to true. Permit initialization of an empty database, never upgrade an existing one.
   */
  constructor(file, createSchema = true) {
    if (!createSchema && !import_node_fs4.default.existsSync(file)) {
      throw new Error(`Analysis database does not exist: ${file}`);
    }
    this.file = file;
    this.#database = new import_node_sqlite2.DatabaseSync(file, { open: true });
    this.#clearHistory = registerRuntimeHistory(this.#database);
    this.#database.function(
      "analysis_json",
      { deterministic: true },
      (value) => value === null ? "{}" : decodeSqlitePayload(value)
    );
    this.#fileIdentity = sqliteFileIdentity(file);
    try {
      const empty = Number(this.#database.prepare("SELECT count(*) AS n FROM sqlite_schema").get()?.n) === 0;
      const initialVersion = Number(
        this.#database.prepare("PRAGMA user_version").get()?.user_version
      );
      if (createSchema && empty && initialVersion === 0) {
        this.#database.exec(SCHEMA2);
        for (const sql of SCHEMA_INDEX_STATEMENTS) {
          this.#database.exec(sql);
        }
      }
      const version = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
      if (version !== ANALYSIS_SQLITE_STORAGE_VERSION) {
        throw new Error(
          `Unsupported analysis storage format ${version}. Expected ${ANALYSIS_SQLITE_STORAGE_VERSION}. Only the current storage format is supported.`
        );
      }
      this.#database.exec(
        "PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-8192; PRAGMA busy_timeout=5000; PRAGMA temp_store=FILE; PRAGMA journal_size_limit=67108864;"
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
      this.#findRuntime = this.#database.prepare(RUNTIME_RECORD_LOOKUP_SQL);
      this.#runtimeWriter = new SqliteRuntimeWriter(this.#database);
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
    if (!this.#database.isTransaction) {
      return;
    }
    try {
      this.#database.exec("ROLLBACK");
    } catch {
    }
  }
  /** Forget all transaction-owned dictionary references and their bounded text allocation. */
  #clearDictionaryCache() {
    this.#clearHistory();
    this.#dictionaryIds.clear();
    this.#dictionaryCacheBytes = 0;
  }
  /**
   * Intern exact text with a bounded cache. Callers hold the SQLite writer lock.
   * @param {string} table One of the two prepared dictionary tables.
   * @param {string} value Exact prefix or serialized evidence list.
   * @returns {number} Transactionally created or existing dictionary rowid.
   */
  #intern(table, value) {
    const key3 = `${table}:${value}`;
    const cached = this.#dictionaryIds.get(key3);
    if (cached !== void 0) {
      return cached;
    }
    const statements = this.#dictionaryStatements.get(table);
    const found = statements.find.get(value);
    const id = found ? Number(found.id) : Number(statements.insert.run(value).lastInsertRowid);
    const bytes = Buffer.byteLength(key3);
    if (this.#dictionaryIds.size >= 256 || this.#dictionaryCacheBytes + bytes > 512 * 1024) {
      this.#clearDictionaryCache();
    }
    if (bytes <= 512 * 1024) {
      this.#dictionaryIds.set(key3, id);
      this.#dictionaryCacheBytes += bytes;
    }
    return id;
  }
  #insertRecord(kind, value) {
    if (kind === "evidence") {
      const record2 = requireMetadataRecord(kind, value);
      this.#insertEvidence.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
      return;
    }
    if (kind === "labels") {
      const record2 = requireMetadataRecord(kind, value);
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
      const record2 = requireMetadataRecord(kind, value);
      this.#insertComment.run(
        record2.id,
        record2.addressSpace,
        record2.address,
        encodeSqlitePayload(JSON.stringify(record2))
      );
      return;
    }
    if (kind === "regions") {
      const record2 = requireMetadataRecord(kind, value);
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
      const record2 = requireMetadataRecord(kind, value);
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
      const record2 = requireMetadataRecord(kind, value);
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
      const record2 = requireMetadataRecord(kind, value);
      this.#insertImport.run(record2.id, encodeSqlitePayload(JSON.stringify(record2)));
      this.recordCaptureReceipt(record2);
      return;
    }
    if (!isRuntimeEvidenceRecord(value)) {
      throw new Error("Invalid stored runtime record.");
    }
    this.#runtimeWriter.insert(value, (table, entry) => this.#intern(table, entry));
  }
  /**
   * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
   * the revision so a competing process cannot slip between the stale check and publication.
   * Throwing rolls back records and manifest changes. Promise/thenable results are rejected. Perform
   * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
   * the manifest themselves when changing semantic records. Prefer the commitAnalysisProject APIs.
   * @param {Function} action Synchronous work. Cursors must be consumed before returning.
   * @param {boolean} [write] Defaults to true (BEGIN IMMEDIATE). False uses deferred BEGIN for reads, not an enforced read-only connection.
   * @returns {T} Callback result after a successful commit.
   */
  transaction(action, write = true) {
    if (sqliteFileIdentity(this.file) !== this.#fileIdentity) {
      throw new Error(
        "Analysis database was replaced. Close this connection and reload the project."
      );
    }
    this.#clearDictionaryCache();
    this.#database.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const revision = write ? this.revision() : 0;
      const result = action();
      if (this.#researchSuspended) {
        throw new Error("Reapply research inputs before publishing imported evidence.");
      }
      if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result && typeof result.then === "function") {
        void Promise.resolve(result).catch(() => void 0);
        throw new TypeError("Analysis transactions require a synchronous callback, not a Promise.");
      }
      if (write) {
        packRuntimeHistory(this.#database);
      }
      if (write && this.revision() !== revision) {
        enforceDatabaseBudget(this.#database);
      }
      this.#database.exec("COMMIT");
      this.#clearDictionaryCache();
      return result;
    } catch (error) {
      this.rollback();
      this.#researchSuspended = false;
      throw error;
    }
  }
  /**
   * Index trace chunks in a connection-local disk table. This transaction never reads or writes
   * main, allowing other project writers to proceed during asynchronous capture parsing.
   * @param {Function} action Async parser using only the supplied temporary counter index.
   * @param {TraceIndexMetrics} metrics Optional caller-owned diagnostic counters.
   * @returns {Promise} Parser result after temporary counters commit. The index lives until connection close.
   */
  async indexTrace(action, metrics) {
    this.#database.exec(`PRAGMA temp.cache_size=-65536;
      CREATE TEMP TABLE trace_facts (
      id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, count INTEGER NOT NULL
    ); BEGIN;`);
    const increment = this.#database.prepare(
      "UPDATE temp.trace_facts SET count=count+1 WHERE id=?"
    );
    const insert = this.#database.prepare("INSERT INTO temp.trace_facts VALUES (?, ?, 1)");
    const values = this.#database.prepare("SELECT payload, count FROM temp.trace_facts");
    const incrementMany = this.#database.prepare(
      "UPDATE temp.trace_facts SET count=count+? WHERE id=?"
    );
    const pending = new TraceCache(metrics);
    const flushEntry = (key3, count) => {
      if (!count) {
        return;
      }
      incrementMany.run(count, key3);
      if (metrics) {
        metrics.sqlStatements++;
      }
    };
    const flush = () => {
      for (const [key3, entry] of pending.entries()) {
        flushEntry(key3, entry.count);
      }
      pending.clear();
    };
    const index = {
      diskBacked: true,
      add: (key3, create) => {
        const entry = pending.get(key3);
        if (entry !== void 0) {
          if (!Number.isSafeInteger(entry.count + 1)) {
            throw new Error("Trace count exceeds exact integer range.");
          }
          entry.count++;
          return false;
        }
        const displaced = pending.insert(key3, { count: 0 });
        if (displaced) {
          flushEntry(displaced.key, displaced.value.count);
        }
        if (metrics) {
          metrics.sqlStatements++;
        }
        if (increment.run(key3).changes !== 0) {
          return false;
        }
        insert.run(key3, JSON.stringify(create()));
        if (metrics) {
          metrics.sqlStatements++;
          metrics.payloads++;
        }
        return true;
      },
      values: function* () {
        flush();
        for (const row of values.iterate()) {
          yield {
            fact: requireTraceFact(parseRecord(row.payload)),
            count: Number(row.count)
          };
        }
      },
      clear: () => {
        pending.clear();
        this.#database.exec("DELETE FROM temp.trace_facts");
      }
    };
    try {
      const result = await action(index);
      flush();
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
    if (!this.#database.isTransaction) {
      throw new Error("Analysis mutation requires a transaction.");
    }
  }
  /** Apply a selected metadata edit by stable ID. Omitted records are never deleted.
   * Validation and optimistic revision checks belong to the publication API.
   * @param {AnalysisProjectShards} before Original selected view.
   * @param {AnalysisProjectShards} after Edited selected view.
   */
  patchMetadata(before, after) {
    this.#requireTransaction();
    for (const kind of [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "evidence",
      "imports"
    ]) {
      const previous = new Map(before[kind].map((record2) => [record2.id, record2]));
      const next = new Map(after[kind].map((record2) => [record2.id, record2]));
      const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const id of /* @__PURE__ */ new Set([...previous.keys(), ...next.keys()])) {
        const prior = previous.get(id), record2 = next.get(id);
        if (canonicalEquals(prior, record2)) {
          continue;
        }
        const stored = find.get(id);
        if (!canonicalEquals(stored ? parseRecord(stored.payload) : void 0, prior)) {
          throw new Error(`Selected ${kind} record '${id}' changed. Reload before editing.`);
        }
        remove.run(id);
        if (record2) {
          this.#insertRecord(kind, record2);
        }
      }
    }
    const retained = new Set(after.evidence.map((record2) => record2.id));
    const removed = before.evidence.filter((record2) => !retained.has(record2.id)).map((record2) => record2.id);
    if (removed.length) {
      const ids = JSON.stringify(removed);
      for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
        if (this.#database.prepare(
          `SELECT 1 FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e WHERE e.value IN (SELECT value FROM json_each(?)) LIMIT 1`
        ).get(ids)) {
          throw new Error("Cannot remove evidence still referenced by retained project records.");
        }
      }
      this.validateRuntimeEvidence();
    }
  }
  /**
   * Rebuild the selected Git research index, without loading runtime history or the CFG. A matching
   * revision is a constant-time no-op. Call inside a transaction and publish the watcher afterward.
   * Research files remain authoritative if the process exits before this cache is refreshed.
   */
  synchronizeResearchInputs(snapshot) {
    this.#requireTransaction();
    const manifest = this.manifest();
    if (snapshot.romSha256 !== manifest.rom.contentSha256) {
      throw new Error("Research inputs belong to another ROM.");
    }
    validateResearchSnapshot(snapshot);
    const indexed = this.#database.prepare("SELECT v FROM meta WHERE k='research-inputs'").get()?.v;
    const revision = this.#database.prepare("SELECT v FROM meta WHERE k='research-index-revision'").get()?.v;
    if (indexed === snapshot.hash && revision === String(this.revision())) {
      return false;
    }
    projectResearchInputs(
      this.#database,
      snapshot,
      (kind, record2) => this.#insertRecord(kind, record2)
    );
    this.validateView({
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      regions: this.loadTable("regions"),
      annotations: this.loadTable("annotations"),
      evidence: this.loadTable("evidence"),
      analysis: this.analysisByKinds(["target-override", "target-set"]),
      imports: [],
      runtime: []
    });
    this.validateRuntimeEvidence();
    const published = this.publishManifest(manifest);
    this.#database.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('research-index-revision',?)").run(String(published.revision));
    this.#researchSuspended = false;
    return true;
  }
  /** Selected Git decision identity for callers pinning a consistent evidence/read snapshot. */
  researchInputsIdentity() {
    const value = this.#database.prepare("SELECT v FROM meta WHERE k='research-inputs'").get()?.v;
    return typeof value === "string" ? value : void 0;
  }
  /** Cheap read-only cache check; callers recheck identity/revision after consuming query results. */
  researchInputsAreCurrent(sha256) {
    const revision = this.#database.prepare("SELECT v FROM meta WHERE k='research-index-revision'").get()?.v;
    return this.researchInputsIdentity() === sha256 && revision === String(this.revision());
  }
  /** Observations stay usable while derived code is stale; generation and graph views require reanalysis. */
  assertCurrentAnalysis() {
    const reason = this.#database.prepare("SELECT v FROM meta WHERE k='analysis-dirty'").get()?.v;
    if (typeof reason === "string") {
      throw new Error(reason);
    }
  }
  /** Invalidate derived code within the same transaction that adds new observations. */
  invalidateAnalysis() {
    this.#requireTransaction();
    this.#database.prepare("INSERT OR REPLACE INTO meta (k,v) VALUES ('analysis-dirty',?)").run(
      "Captured evidence changed. Analyze the selected inputs before regenerating or querying the derived graph."
    );
  }
  /** Restore observations inside an import transaction; reapply the selected research before commit. */
  suspendResearchInputs() {
    this.#requireTransaction();
    this.#researchSuspended = true;
    clearResearchProjection(this.#database, (kind, record2) => this.#insertRecord(kind, record2));
  }
  /**
   * Publish analyzer output computed from the projected view without adopting Git decisions as
   * imported facts. Overridden IDs retain their observation shadows; removing a decision on a
   * later branch therefore restores the original record. Return the exact projected replacements
   * for validation without reparsing a million-row graph into a second set of JS objects.
   */
  replaceResearchAnalysis(snapshot, updates, onProgress) {
    this.#requireTransaction();
    if (this.researchInputsIdentity() !== snapshot.hash) {
      throw new Error("Analysis publication requires the selected Git research snapshot.");
    }
    this.suspendResearchInputs();
    const projected = {};
    for (const key3 of Object.keys(updates)) {
      if (!isResearchUpdate(key3)) {
        throw new Error("Analysis may only replace derived metadata collections.");
      }
      const collection = key3;
      const protectedIds = new Set(
        snapshot.decisions.filter((decision) => decision.collection === collection).map((decision) => decision.id)
      );
      const records = (updates[collection] ?? []).filter((record2) => !protectedIds.has(record2.id));
      const current = [...records];
      for (const decision of snapshot.decisions) {
        if (decision.collection === collection && decision.value !== null) {
          current.push(decision.value);
        }
      }
      Object.assign(projected, { [collection]: current });
      const find = this.#database.prepare(`SELECT payload FROM ${collection} WHERE id=?`);
      for (const id of protectedIds) {
        const row = find.get(id);
        if (row) {
          const parsed = JSON.parse(decodeSqlitePayload(row.payload));
          switch (collection) {
            case "analysis":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "annotations":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "comments":
              records.push(requireMetadataRecord(collection, parsed));
              break;
            case "evidence":
              records.push(requireMetadataRecord(collection, parsed));
              break;
          }
        }
      }
      this.replaceTables({ [collection]: records });
      onProgress?.(collection);
    }
    this.publishManifest(this.manifest());
    this.synchronizeResearchInputs(snapshot);
    this.#database.exec("DELETE FROM meta WHERE k='analysis-dirty'");
    return projected;
  }
  /**
   * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
   * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
   * Semantic validation belongs to the project publication API. This method must run in its transaction.
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
    for (const key3 of Object.keys(shards)) {
      if (!isShardKind(key3) || !tables.has(key3)) {
        throw new Error(`Unknown analysis table '${key3}'.`);
      }
      const kind = key3;
      if (kind === "runtime") {
        this.#replaceRuntime(shards.runtime ?? []);
        continue;
      }
      if (!this.#database.prepare(`SELECT 1 FROM ${kind} LIMIT 1`).get()) {
        for (const record2 of shards[kind] ?? []) {
          this.#insertRecord(kind, record2);
        }
        continue;
      }
      this.#database.exec("DELETE FROM temp.replacement_ids");
      const find = this.#database.prepare(`SELECT payload FROM ${kind} WHERE id=?`);
      const remove = this.#database.prepare(`DELETE FROM ${kind} WHERE id=?`);
      for (const record2 of shards[kind] ?? []) {
        remember.run(record2.id);
        const prior = find.get(record2.id);
        if (prior) {
          const json = decodeSqlitePayload(prior.payload);
          if (json === JSON.stringify(record2)) {
            continue;
          }
          const before = JSON.parse(json);
          if (canonicalEquals(before, record2)) {
            continue;
          }
          remove.run(record2.id);
        }
        this.#insertRecord(kind, record2);
      }
      this.#database.exec(
        `DELETE FROM ${kind} WHERE id NOT IN (SELECT id FROM temp.replacement_ids)`
      );
    }
  }
  /**
   * Replace runtime by interned external identities, including virtual paired-state records.
   * @param {Array} records Complete semantic runtime replacement. Duplicate IDs remain errors.
   */
  #replaceRuntime(records) {
    this.#database.exec(
      "CREATE TEMP TABLE IF NOT EXISTS replacement_runtime_ids (prefix TEXT, id BLOB, PRIMARY KEY(prefix,id)) WITHOUT ROWID; DELETE FROM replacement_runtime_ids"
    );
    const remember = this.#database.prepare(
      "INSERT OR IGNORE INTO temp.replacement_runtime_ids VALUES (?,?)"
    );
    const remove = this.#database.prepare("DELETE FROM runtime WHERE rowid=?");
    for (const record2 of records) {
      const identity = sqliteRuntimeIdentity(record2.id);
      if (!remember.run(identity.prefix, identity.suffix).changes) {
        throw new Error(`Duplicate runtime record ID '${record2.id}'.`);
      }
      const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
      if (prior && canonicalEquals(runtimeFromRow(prior), record2)) {
        continue;
      }
      if (prior) {
        remove.run(prior.storage_rowid);
      }
      this.#insertRecord("runtime", record2);
    }
    this.#database.exec(`DELETE FROM runtime WHERE NOT EXISTS (
      SELECT 1 FROM temp.replacement_runtime_ids keep JOIN runtime_prefixes p ON p.value=keep.prefix
      WHERE p.id=runtime.prefix_id AND keep.id=runtime.id)`);
  }
  /**
   * Insert a content-addressed runtime fact once. An ID collision with different content is an
   * error, never a silent no-op. Count values are already aggregated within the source capture.
   * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
   * @returns {boolean} True when inserted. Identical facts return false and conflicting facts throw.
   */
  insertRuntime(record2) {
    this.#requireTransaction();
    const identity = sqliteRuntimeIdentity(record2.id);
    const prior = this.#findRuntime.get(identity.prefix, identity.suffix);
    if (prior) {
      if (!canonicalEquals(runtimeFromRow(prior), record2)) {
        throw new Error(
          `Runtime record '${record2.id}' has changed content for a stable imported ID.`
        );
      }
      return false;
    }
    this.#insertRecord("runtime", record2);
    return true;
  }
  /** Prepare a unique-record batch in one source namespace, inside the publication transaction.
   * New namespaces need no per-record existence query. SQL uniqueness still rejects repeated IDs.
   * Existing/partially pruned sources use full idempotency and collision checks for every record.
   * The callback must not escape its transaction. Any insertion error must abort the whole batch.
   * @param {string} prefix Exact ID prefix including its final colon.
   * @returns {Function} Transaction-scoped inserter for validated records with unique suffixes.
   */
  runtimeBatchInserter(prefix) {
    this.#requireTransaction();
    if (!prefix || !prefix.endsWith(":")) {
      throw new Error("Invalid runtime batch prefix.");
    }
    const existing = this.#database.prepare(
      "SELECT 1 FROM runtime WHERE prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) LIMIT 1"
    ).get(prefix);
    return (record2) => {
      this.#requireTransaction();
      if (!record2.id.startsWith(prefix) || record2.id.lastIndexOf(":") !== prefix.length - 1) {
        throw new Error("Runtime record escaped its batch prefix.");
      }
      if (existing) {
        return this.insertRuntime(record2);
      }
      this.#insertRecord("runtime", record2);
      return true;
    };
  }
  /**
   * Prepare bounded bulk publication for a validated distinct instruction trace. All four source
   * namespaces must be empty; receipts cannot prove this after pruning. Retained/partial sources
   * use exact per-record comparisons and repair. Call finish() before the writer transaction commits.
   * The sink and its pending buffers belong to this transaction and must not escape it.
   */
  runtimeTracePublicationSink(sourceSha256) {
    this.#requireTransaction();
    if (!/^[\da-f]{64}$/.test(sourceSha256)) {
      throw new Error("Invalid trace source SHA-256.");
    }
    const root = `runtime:instruction-trace:${sourceSha256}:`;
    const existing = this.#database.prepare(`
      SELECT 1 FROM runtime_observations
      WHERE prefix_id IN (SELECT id FROM runtime_prefixes WHERE value IN (?1,?2,?3,?4))
      UNION ALL SELECT 1 FROM runtime_observations
      WHERE state_prefix_id IN (SELECT id FROM runtime_prefixes WHERE value IN (?1,?2,?3,?4))
      LIMIT 1
    `).get(root, `${root}code:`, `${root}state:`, `${root}memory:`);
    if (!existing) {
      const batch = new SqliteRuntimeTraceBatch(
        this.#database,
        sourceSha256,
        (table, value) => this.#intern(table, value)
      );
      return {
        add: (record2) => {
          this.#requireTransaction();
          return batch.add(record2);
        },
        finish: () => {
          this.#requireTransaction();
          batch.finish();
        }
      };
    }
    let finished = false;
    return {
      add: (record2) => {
        this.#requireTransaction();
        if (finished) {
          throw new Error("Runtime trace batch is no longer active.");
        }
        assertTraceRecordNamespace(record2, sourceSha256);
        return this.insertRuntime(record2);
      },
      finish: () => {
        this.#requireTransaction();
        if (finished) {
          throw new Error("Runtime trace batch is no longer active.");
        }
        finished = true;
      }
    };
  }
  /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
  validateRuntimeEvidence() {
    const missing = this.#database.prepare(`
      WITH missing AS MATERIALIZED (
        SELECT sets.id, ref.value AS evidence FROM runtime_evidence AS sets, json_each(sets.value) AS ref
        LEFT JOIN evidence ON evidence.id=ref.value WHERE evidence.id IS NULL
      )
      SELECT evidence FROM missing
      WHERE EXISTS (SELECT 1 FROM runtime_observations WHERE evidence_id=missing.id) LIMIT 1
    `).get();
    if (missing) {
      throw new Error(`Runtime history refers to missing evidence '${String(missing.evidence)}'.`);
    }
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
   * Current publication counter, or zero before initial publication. It is not a schema version.
   * Read it with related records inside transaction to retain one consistent snapshot.
   * @returns {number} Stored revision.
   */
  revision() {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='revision'").get();
    return Number(row?.v ?? 0);
  }
  /**
   * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
   * Use a transaction when combining it with other reads. This does not validate the entire project.
   * @returns {AnalysisProjectManifest} Pointer manifest.
   */
  manifest() {
    const row = this.#database.prepare("SELECT v FROM meta WHERE k='manifest'").get();
    if (!row) {
      throw new Error("Sqlite analysis project is missing its stored manifest.");
    }
    const parsed = parseRecord(row.v);
    if (!isRecord4(parsed)) {
      throw new Error("Sqlite analysis project is missing its stored manifest.");
    }
    validateAnalysisProjectManifest(parsed);
    return { ...parsed, revision: this.revision() };
  }
  /**
   * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
   * @param {Array} kinds Runtime discriminators to include. Empty selects nothing.
   * @returns {IterableIterator} Cursor consumed within the owning read transaction.
   * @yields {RuntimeEvidenceRecord} One matching decoded fact.
   */
  *runtimeRecordsByKinds(kinds) {
    if (kinds.length === 0) {
      return;
    }
    const statement = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN (${kinds.map(() => "?").join(", ")})`
    );
    for (const row of statement.iterate(...kinds)) {
      yield runtimeFromRow(row);
    }
  }
  /**
   * Stream runtime facts without retaining the complete table. Consume before the owning transaction
   * returns or the connection closes. An escaped iterator does not preserve its original snapshot.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
   * @yields {RuntimeEvidenceRecord} One runtime fact.
   */
  *runtimeRecords() {
    for (const sql of RUNTIME_RECORD_STREAM_SQL) {
      for (const row of this.#database.prepare(sql).iterate()) {
        yield runtimeFromRow(row);
      }
    }
  }
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
    if (!Object.hasOwn(order, kind)) {
      throw new Error(`Unknown analysis table '${kind}'.`);
    }
    const records = [];
    for (const row of this.#database.prepare(`SELECT payload FROM ${kind} ORDER BY ${order[kind]}`).iterate()) {
      records.push(requireMetadataRecord(kind, parseRecord(row.payload)));
    }
    return records;
  }
  /** Validate a query view against this read snapshot, including every included provenance reference.
   * @param {AnalysisProjectShards} shards Selected records, with unused collections empty.
   */
  validateView(shards) {
    validateLoadedShards(shards, this.manifest());
  }
  /** Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
   * The caller owns revision checking and publication in the surrounding writer transaction.
   * @param {RuntimeEvidenceBatch} batch Imported facts and metadata.
   * @returns {object} Whether anything changed and per-collection additions/updates.
   */
  mergeEvidenceBatch(batch) {
    this.#requireTransaction();
    const base = {
      analysis: [],
      annotations: this.loadTable("annotations"),
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      regions: this.loadTable("regions"),
      evidence: this.loadTable("evidence"),
      imports: this.loadTable("imports"),
      runtime: []
    };
    const ids = JSON.stringify((batch.analysis ?? []).map((record2) => record2.id));
    const analysis = this.#database.prepare("SELECT payload FROM analysis WHERE id IN (SELECT value FROM json_each(?))").all(ids).map((row) => requireMetadataRecord("analysis", parseRecord(row.payload)));
    const before = { ...base, analysis };
    const merged = mergeRuntimeEvidence(before, { ...batch, runtime: [] });
    this.validateView({ ...merged.shards, runtime: batch.runtime ?? [] });
    this.patchMetadata(before, merged.shards);
    let runtime = 0;
    for (const record2 of batch.runtime ?? []) {
      if (this.insertRuntime(record2)) {
        runtime++;
      }
    }
    return {
      changed: merged.changed || runtime > 0,
      added: { ...merged.added, runtime },
      updated: merged.updated
    };
  }
  /** Produce an explicit complete evidence report one qualified PC at a time.
   * Only report output accumulates. Unused instruction/memory histories and CFG contexts are never loaded.
   * @returns {object} Runtime record count, conflicts, and metadata explanations.
   */
  inspectEvidence() {
    const shards = {
      analysis: this.analysisByKinds(["target-override"]),
      annotations: this.loadTable("annotations"),
      evidence: this.loadTable("evidence"),
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      runtime: []
    };
    const conflicts = [];
    const rows = this.#database.prepare(
      `${RUNTIME_SELECT} WHERE r.kind IN ('runtime-execution','runtime-cpu-state') AND r.address_space=? AND r.address=? AND r.architecture=?`
    );
    const sites = this.#database.prepare(
      "SELECT DISTINCT architecture,address_space,address FROM runtime WHERE kind IN ('runtime-execution','runtime-cpu-state')"
    );
    for (const site of sites.iterate()) {
      const runtime = [];
      for (const row of rows.iterate(site.address_space, site.address, site.architecture)) {
        runtime.push(runtimeFromRow(row));
      }
      for (const conflict of inspectRuntimeEvidence({ ...shards, runtime }).conflicts) {
        conflicts.push(conflict);
      }
    }
    conflicts.sort((a, b) => a.id.localeCompare(b.id));
    return {
      runtimeRecords: Number(this.#database.prepare("SELECT count(*) AS n FROM runtime").get().n),
      conflicts,
      explanations: inspectRuntimeEvidence(shards).explanations
    };
  }
  /** Select record choices before decoding. Explicit IDs bypass unrelated history entirely.
   * @param {Partial<Record<ShardKind, readonly string[]>>} [selected] Exact context record IDs. Omitted lists the first 200 records per collection.
   * @returns {AnalysisProjectShards} Bounded choice view and complete small provenance catalog.
   */
  evidenceChoices(selected) {
    const shards = {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      imports: [],
      evidence: this.loadTable("evidence")
    };
    for (const kind of [
      "analysis",
      "annotations",
      "labels",
      "comments",
      "regions",
      "runtime",
      "imports"
    ]) {
      const records = [];
      const ids = selected?.[kind];
      if (selected && !ids?.length) {
        continue;
      }
      if (kind === "runtime") {
        if (ids) {
          for (const id of ids.slice(0, 200)) {
            const identity = sqliteRuntimeIdentity(id);
            const row = this.#findRuntime.get(identity.prefix, identity.suffix);
            if (row) {
              records.push(runtimeFromRow(row));
            }
          }
        } else {
          for (const row of this.#database.prepare(`${RUNTIME_SELECT} LIMIT 200`).iterate()) {
            records.push(runtimeFromRow(row));
          }
        }
      } else {
        const sql = ids ? `SELECT payload FROM ${kind} WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 200` : `SELECT payload FROM ${kind} ORDER BY id LIMIT 200`;
        const parameters = ids ? [JSON.stringify(ids)] : [];
        for (const row of this.#database.prepare(sql).iterate(...parameters)) {
          records.push(requireMetadataRecord(kind, parseRecord(row.payload)));
        }
      }
      Object.assign(shards, { [kind]: records });
    }
    return shards;
  }
  /** Find candidate evidence IDs still owned by retained runtime observations.
   * Reads the small provenance dictionary and physical observation rows without decoding histories.
   * Caller holds the same read snapshot as the metadata being used for a replacement publication.
   * @param {readonly string[]} ids Evidence candidates; empty input performs no query.
   * @returns {string[]} Referenced candidate IDs in stable order, bounded by the input size.
   */
  runtimeEvidenceReferences(ids) {
    if (ids.length === 0) {
      return [];
    }
    return this.#database.prepare(`SELECT DISTINCT ref.value AS id
      FROM runtime_evidence AS sets, json_each(sets.value) AS ref
      WHERE ref.value IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM runtime_observations WHERE evidence_id=sets.id)
      ORDER BY ref.value`).all(JSON.stringify(ids)).map((row) => String(row.id));
  }
  /** Explain one record with an exact reference count and a bounded reverse-reference preview.
   * @param {ShardKind} kind Selected collection.
   * @param {string} id Stable semantic record ID.
   * @returns {ProjectEvidenceExplanation} Full direct provenance/conflicts, at most 200 reverse links.
   */
  explainEvidence(kind, id) {
    const signature = "1";
    if (!readQueryCache(this.#database, "evidence_links", signature)) {
      this.transaction(() => {
        installQueryCache(this.#database, "evidence_links", [
          "analysis",
          "annotations",
          "labels",
          "comments",
          "regions"
        ]);
        this.#database.exec(
          "CREATE TABLE IF NOT EXISTS query_evidence_links(evidence TEXT,collection TEXT,id TEXT,PRIMARY KEY(evidence,collection,id)) WITHOUT ROWID;DELETE FROM query_evidence_links;"
        );
        for (const table of ["analysis", "annotations", "labels", "comments", "regions"]) {
          this.#database.exec(
            `INSERT OR IGNORE INTO query_evidence_links SELECT e.value,'${table}',r.id FROM ${table} r,json_each(analysis_json(r.payload),'$.evidence') e`
          );
        }
        writeQueryCache(this.#database, "evidence_links", signature, true);
      });
    }
    return this.transaction(() => {
      const shards = this.evidenceChoices({ [kind]: [id] });
      const view = {
        ...shards,
        analysis: [
          ...shards.analysis,
          ...this.analysisByKinds(["conflict"]).filter(
            (record2) => !shards.analysis.some((other) => other.id === record2.id)
          )
        ]
      };
      const base = explainProjectEvidence(view, kind, id);
      const evidenceIds = JSON.stringify(base.evidence.map((record2) => record2.id));
      const metadata = "SELECT collection||':'||id AS reference FROM query_evidence_links WHERE evidence IN (SELECT value FROM json_each(?)) GROUP BY collection,id";
      const runtime = "SELECT 'runtime:'||p.value||CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END AS reference FROM runtime_evidence e JOIN runtime r ON r.evidence_id=e.id JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?)))";
      const metadataRows = this.#database.prepare(`${metadata} ORDER BY reference LIMIT 200`).all(evidenceIds);
      const runtimeRows = this.#database.prepare(`${runtime} ORDER BY r.prefix_id,r.id LIMIT 200`).all(evidenceIds);
      const referencedBy = [...metadataRows, ...runtimeRows].map((row) => String(row.reference)).toSorted((a, b) => a.localeCompare(b)).slice(0, 200);
      const metadataCount = Number(
        this.#database.prepare(`SELECT count(*) AS n FROM (${metadata})`).get(evidenceIds).n
      );
      const runtimeCount = Number(
        this.#database.prepare(`SELECT count(*) AS n FROM runtime r WHERE r.evidence_id IN
        (SELECT e.id FROM runtime_evidence e WHERE EXISTS(SELECT 1 FROM json_each(e.value) value WHERE value.value IN (SELECT value FROM json_each(?))))`).get(evidenceIds).n
      );
      const referencedByTotal = metadataCount + runtimeCount;
      return { ...base, referencedBy, referencedByTotal };
    }, false);
  }
  /** Exact coverage totals. Build only when classifications, code, or runtime facts changed.
   * @returns {object} Persisted summary and detail count.
   */
  coverageSummary() {
    const cached = cachedCoverage(this.#database, this.manifest());
    if (cached) {
      return cached;
    }
    this.prepareAnnotationQueries();
    try {
      this.cachedProjection(
        "coverage",
        coverageSignature(this.manifest()),
        ["analysis", "annotations", "regions", "runtime"],
        () => prepareCoverage(this.#database, this.manifest()),
        () => publishCoverage(this.#database),
        (value) => {
          if (!isSqliteCoverageSummary(value)) {
            throw new Error("Project changed while building coverage. Refresh the view.");
          }
          return value;
        }
      );
      const published = cachedCoverage(this.#database, this.manifest());
      if (!published) {
        throw new Error("Project changed while building coverage. Refresh the view.");
      }
      return published;
    } finally {
      this.#database.exec(
        "DROP TABLE IF EXISTS temp.query_coverage_segments;DROP TABLE IF EXISTS temp.query_coverage_details"
      );
    }
  }
  /** Read at most 200 coverage rows from a current projection.
   * @param {"segments" | "details"} kind Collection to page.
   * @param {number} offset Nonnegative row offset.
   * @returns {unknown[]} Persisted rows, never the full ROM map.
   */
  coveragePage(kind, offset = 0) {
    this.coverageSummary();
    return this.transaction(() => coveragePage(this.#database, kind, offset), false);
  }
  /** Current conflicting ROM intervals, paged at 200 rows; offsets count conflicts only. */
  coverageConflicts(offset = 0) {
    this.coverageSummary();
    return this.transaction(() => coverageConflictPage(this.#database, offset), false);
  }
  /** Persisted call graph plus current labels, without retaining CFG contexts between requests.
   * @returns {object} Functions, calls, unresolved sites, and ownership.
   */
  callGraph() {
    this.assertCurrentAnalysis();
    let graph;
    try {
      graph = this.cachedProjection(
        "graph",
        "3",
        ["analysis"],
        () => prepareGraph(this.#database),
        () => publishGraph(this.#database),
        (value) => {
          if (!isCallGraph(value)) {
            throw new Error("Analysis changed while building the graph. Refresh the view.");
          }
          return value;
        }
      );
      const published = readQueryCache(this.#database, "graph", "3");
      if (!isCallGraph(published)) {
        throw new Error("Analysis changed while building the graph. Refresh the view.");
      }
      graph = published;
    } finally {
      this.#database.exec(
        "DROP TABLE IF EXISTS temp.query_graph_nodes;DROP TABLE IF EXISTS temp.query_graph_edges"
      );
    }
    const labels = this.loadTable("labels");
    return {
      ...graph,
      functions: graph.functions.map(
        (fn) => Object.assign({}, fn, {
          labels: labels.filter(
            (label) => label.addressSpace === fn.addressSpace && label.address === fn.address
          ).map(({ id, name: name2 }) => ({ id, name: name2 })).toSorted((a, b) => a.id.localeCompare(b.id))
        })
      )
    };
  }
  /** Cache a compact target-specific result. Callers declare every persisted input it consumes.
   * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
   * Concurrent input changes discard cache publication. Results still belong to one read snapshot.
   * @param {string} key Internal stable query name.
   * @param {string} signature Layout/configuration fingerprint.
   * @param {readonly ShardKind[]} dependencies Source collections.
   * @param {Function} compute Synchronous reader. Must not open another transaction.
   * @param {Function} [publish] Optional short SQL publication for derived rows built in temporary tables.
   * @returns {T} Current projected value.
   */
  cachedProjection(key3, signature, dependencies, compute, publish, restore) {
    const cached = readQueryCache(this.#database, key3, signature);
    if (cached !== void 0) {
      if (!restore) {
        throw new Error(`Query cache '${key3}' requires a restore function.`);
      }
      return restore(cached);
    }
    const pending = `pending:${(0, import_node_crypto4.randomUUID)()}`;
    this.transaction(() => {
      installQueryCache(this.#database, key3, dependencies);
      writeQueryCache(this.#database, key3, pending, null);
    });
    const result = this.transaction(compute, false);
    this.transaction(() => {
      if (this.#database.prepare("SELECT signature FROM query_cache WHERE name=?").get(key3)?.signature === pending) {
        publish?.();
        writeQueryCache(this.#database, key3, signature, result);
      }
    });
    return result;
  }
  /** Select a bounded CFG navigation window through its address index.
   * @param {string} space Exact logical address space.
   * @param {number} address Selected PC.
   * @param {readonly string[]} architectures Optional specification prefixes.
   * @returns {AnalysisRecord[]} Four preceding and 28 following variants, in address order.
   */
  navigationNodes(space, address, architectures) {
    const matches = architectures.length ? " AND EXISTS(SELECT 1 FROM json_each(?) h WHERE json_extract(analysis_json(payload),'$.specificationId')=h.value OR substr(json_extract(analysis_json(payload),'$.specificationId'),1,length(h.value)+1)=h.value||'.')" : "";
    const parameters = [space, address];
    if (architectures.length) {
      parameters.push(JSON.stringify(architectures));
    }
    const before = this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address<? ${matches} ORDER BY address DESC,id DESC LIMIT 4`
    ).all(...parameters).toReversed();
    const after = this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind='cfg-node' AND address_space=? AND address>=? ${matches} ORDER BY address,id LIMIT ?`
    ).all(...parameters, 32 - before.length);
    return [...before, ...after].map(
      (row) => requireMetadataRecord("analysis", parseRecord(row.payload))
    );
  }
  /** Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
   * @returns {Array} Half-open ROM-content intervals.
   */
  codeRanges() {
    return this.#database.prepare(
      "SELECT file_offset AS start,MAX(file_offset+size) AS end FROM query_instruction_nodes WHERE file_offset IS NOT NULL GROUP BY file_offset"
    ).all().map((row) => ({ start: Number(row.start), end: Number(row.end) }));
  }
  /** Select processor MMIO observations before decoding payloads.
   * @param {string} architecture Exact runtime architecture.
   * @param {string} space Instruction and accessed logical space.
   * @param {readonly number[]} addresses Exact hardware addresses, including target-approved mirrors.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL-grouped observations. Counts/provenance stay exact.
   * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
   */
  *runtimeMemoryAtAddresses(architecture, space, addresses) {
    const sql = `WITH candidates AS MATERIALIZED (SELECT r.*,analysis_json(r.payload) AS json FROM runtime r
      WHERE r.kind='runtime-memory-access' AND r.architecture=? AND r.instruction_address_space=? AND r.accessed_address_space=?
      AND r.accessed_address IN (SELECT value FROM json_each(?))), grouped AS (
      SELECT *,SUM(count) AS total FROM candidates GROUP BY instruction_address,accessed_address,evidence_id,
      json_extract(json,'$.access'),json_extract(json,'$.actor'),json_extract(json,'$.channel'))
      SELECT g.*,p.value AS id_prefix,e.value AS evidence FROM grouped g JOIN runtime_prefixes p ON p.id=g.prefix_id JOIN runtime_evidence e ON e.id=g.evidence_id`;
    for (const row of this.#database.prepare(sql).iterate(architecture, space, space, JSON.stringify(addresses))) {
      yield runtimeFromRow({ ...row, count: row.total });
    }
  }
  /** Decode-state variants aggregated in SQL. Raw register histories never become a JS array.
   * The signature includes the ordered state fields and architecture. Aliases remain distinct so
   * the target decoder retains its original precedence and validation rules.
   * @param {string} architecture Exact instruction architecture.
   * @param {string} space Exact instruction address space.
   * @param {readonly string[]} stateFields Only fields the target decoder consumes, including aliases.
   * @param {Readonly<Record>} masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
   * @param {Function} [onProgress] Cumulative and total observations when rebuilding; throwing aborts the build.
   * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL cursor over compact variants with exact per-evidence counts.
   * Prepare before starting the consuming read transaction.
   */
  runtimeInstructionVariants(architecture, space, stateFields, masks = {}, onProgress) {
    return runtimeInstructionSummary(
      this.#database,
      (action, write) => this.transaction(action, write),
      architecture,
      space,
      stateFields,
      masks,
      onProgress
    );
  }
  /** Exact execution seed totals grouped by PC, without decoding execution payloads.
   * Stream per-provenance SQL totals into one seed per PC; capture attribution remains in runtime
   * storage. Static seed selection needs their union, not millions of duplicate PC records.
   * @param {string} architecture Target processor.
   * @param {string} space Logical CPU address space.
   * @returns {RuntimeEvidenceRecord[]} Execution facts reduced to the fields used for seed selection.
   */
  runtimeExecutionSeeds(architecture, space) {
    const seeds = /* @__PURE__ */ new Map();
    for (const row of this.#database.prepare(`SELECT r.address,SUM(r.count) AS count,r.evidence_id,e.value AS evidence FROM runtime r JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE r.kind='runtime-execution' AND r.architecture=? AND r.address_space=? GROUP BY r.address,r.evidence_id`).iterate(architecture, space)) {
      const address = Number(row.address);
      const seed = seeds.get(address) ?? { count: 0, evidence: /* @__PURE__ */ new Set() };
      seed.count += Number(row.count);
      const parsedEvidence = JSON.parse(String(row.evidence));
      if (!isStringArray(parsedEvidence)) {
        throw new Error("Invalid runtime evidence list.");
      }
      for (const id of parsedEvidence) {
        seed.evidence.add(id);
      }
      seeds.set(address, seed);
    }
    return [...seeds].toSorted(([a], [b]) => a - b).map(([address, seed]) => ({
      id: `query:execution:${address}`,
      kind: "runtime-execution",
      architecture,
      addressSpace: space,
      address,
      count: seed.count,
      evidence: [...seed.evidence].toSorted()
    }));
  }
  /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
  prepareAnnotationQueries() {
    if (annotationQueryIndexesReady(this.#database)) {
      return;
    }
    this.transaction(() => ensureAnnotationQueryIndexes(this.#database));
  }
  /** Prepare direct source attribution indexes without decoding runtime payloads. */
  prepareSourceQueries() {
    if (!sourceQueriesReady(this.#database)) {
      this.transaction(() => prepareSourceQueries(this.#database));
    }
  }
  /** Validated source identities from small catalog tables in the caller's read snapshot.
   * @returns {object} Manifest and sources ordered by their most recent successful import.
   */
  sourceCatalog() {
    const manifest = this.manifest();
    const shards = {
      imports: this.loadTable("imports"),
      evidence: this.loadTable("evidence"),
      analysis: [],
      labels: [],
      comments: [],
      annotations: [],
      regions: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    const importTimes = new Map(
      this.#database.prepare("SELECT sha256,last_seen_at FROM capture_catalog").all().map((row) => [String(row.sha256), Number(row.last_seen_at)])
    );
    return { manifest, sources: buildAnalysisSourceCatalog(shards, importTimes) };
  }
  /** Exact SQL counts for a catalog source. No baseline or inferred static execution.
   * @param {string} sourceId Catalog source ID.
   * @returns {object} Manifest and source counts.
   */
  sourceSummary(sourceId) {
    const { manifest, sources } = this.sourceCatalog();
    const source = sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return { manifest, summary: readSourceSummary(this.#database, source) };
  }
  /** At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
   * @param {string} sourceId Catalog source ID.
   * @param {AnalysisSourceGroup} group Contribution category.
   * @param {number} offset Nonnegative page offset.
   * @returns {Array} Bounded source records.
   */
  sourcePage(sourceId, group, offset = 0) {
    const source = this.sourceCatalog().sources.find(({ id }) => id === sourceId);
    if (!source) {
      throw new Error("Unknown analysis source.");
    }
    return readSourcePage(this.#database, source, group, offset);
  }
  /**
   * Read names, comments and provenance for editing without materializing instruction variants.
   * @returns {object} Validated editing metadata from the caller's read transaction.
   */
  annotationEditView() {
    const manifest = this.manifest();
    const shards = {
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      evidence: this.loadTable("evidence"),
      analysis: this.analysisByKinds(["function"]),
      annotations: [],
      regions: [],
      imports: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    return { manifest, shards };
  }
  /** Small export metadata. Instruction candidates are supplied separately by an ordered SQL cursor.
   * @returns {object} Validated manifest, metadata, and an empty runtime collection.
   */
  sourceExportView() {
    this.assertCurrentAnalysis();
    const manifest = this.manifest();
    const shards = {
      labels: this.loadTable("labels"),
      comments: this.loadTable("comments"),
      evidence: this.loadTable("evidence"),
      regions: this.loadTable("regions"),
      annotations: this.loadTable("annotations"),
      analysis: this.analysisByKinds(["function", "conflict"]),
      imports: [],
      runtime: []
    };
    validateLoadedShards(shards, manifest);
    return { manifest, shards };
  }
  /**
   * Stream one file-offset group at a time. Do not retain the complete CFG to plan source.
   * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
   * @returns {IterableIterator<readonly InstructionExportRecord[]>} All variants at each explicit output offset.
   * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
   */
  *instructionExportGroups() {
    const spaces = new Map(
      this.manifest().addressSpaces.map((space) => [space.id, 2 ** space.addressBits])
    );
    const evidence = new Set(this.loadTable("evidence").map(({ id }) => id));
    let previous;
    let group = [];
    for (const row of this.#database.prepare(
      "SELECT file_offset,data FROM query_instruction_nodes WHERE file_offset IS NOT NULL ORDER BY file_offset"
    ).iterate()) {
      const offset = Number(row.file_offset);
      if (previous !== void 0 && previous !== offset) {
        yield group;
        group = [];
      }
      const record2 = parseSqlitePayload(row.data);
      if (!isIndexedExportInstruction(record2, spaces, evidence)) {
        throw new Error("Invalid indexed export instruction or missing provenance.");
      }
      group.push(record2);
      previous = offset;
    }
    if (group.length) {
      yield group;
    }
  }
  /**
   * Read and validate only the requested instruction metadata and bounded runtime details.
   * @param {readonly AnnotationQueryRange[]} ranges Exact visible source/debugger coordinates.
   * @returns {SqliteAnnotationView} Small view. Consume inside the caller's read transaction.
   */
  instructionAnnotationView(ranges) {
    const manifest = this.manifest();
    const result = readSqliteAnnotationView(this.#database, manifest, ranges);
    validateLoadedShards(result.shards, manifest, "partial");
    return result;
  }
  /**
   * Exact viewport counts without materializing the detailed instruction projection.
   * @param {readonly AnnotationQueryRange[]} ranges Current mapped coordinates, validated by the query.
   * @returns {readonly InstructionExecutionSummaryRow[]} Bounded locations with exact execution totals.
   */
  instructionExecutionSummary(ranges) {
    return readInstructionExecutionSummary(this.#database, this.manifest(), ranges);
  }
  /**
   * Read selected metadata kinds through the address index instead of loading the complete CFG.
   * @param {readonly AnalysisRecord["kind"][]} kinds Analysis discriminators to include.
   * @returns {AnalysisRecord[]} Matching rows in stable ID order.
   */
  analysisByKinds(kinds) {
    if (!kinds.length) {
      return [];
    }
    const records = [];
    for (const row of this.#database.prepare(
      `SELECT payload FROM analysis WHERE kind IN (${kinds.map(() => "?").join(",")}) ORDER BY id`
    ).iterate(...kinds)) {
      records.push(requireMetadataRecord("analysis", parseRecord(row.payload)));
    }
    return records;
  }
  /**
   * Resolve an edit boundary to representative CFG nodes, one per qualified location.
   * Call after preparing query indexes and consume inside a read transaction.
   * @param {string} addressSpace Exact debug-map/native address space.
   * @param {number} address Instruction start in that space.
   * @param {number} [outputOffset] Optional explicit file offset, never an inferred mapper alias.
   * @returns {AnalysisProjectShards["analysis"]} Location representatives. State variants need not be loaded to edit a comment.
   */
  annotationNodesAt(addressSpace, address, outputOffset) {
    const rows = this.#database.prepare(`SELECT payload FROM analysis WHERE rowid IN (
      SELECT MIN(rowid) FROM analysis WHERE kind='cfg-node' AND address_space=? AND address=? GROUP BY address_space,address
      UNION SELECT MIN(rowid) FROM analysis INDEXED BY query_instruction_output
      WHERE kind='cfg-node' AND query_file_offset=? GROUP BY address_space,address)`).all(addressSpace, address, outputOffset ?? null);
    return rows.map((row) => requireMetadataRecord("analysis", parseRecord(row.payload)));
  }
  /**
   * Materialize complete record arrays without semantic validation. Run inside a read transaction.
   * @param {boolean} [runtime] Defaults to true. False omits runtime and must not be treated as a complete replacement.
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
      runtime: runtime ? [...this.runtimeRecords()].toSorted(compareRuntimeRecordIds) : []
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
   * Count analysis kinds without inflating or parsing their compressed payloads.
   * @returns {Readonly<Record<string, number>>} Counts by analysis record discriminator.
   */
  analysisCounts() {
    const result = {};
    for (const row of this.#database.prepare("SELECT kind, COUNT(*) AS n FROM analysis GROUP BY kind").iterate()) {
      result[String(row.kind)] = Number(row.n);
    }
    return result;
  }
  /**
   * Summarize per-PC execution facts using stored columns, without reading register history.
   * @returns {object} Fact count and total observed executions in the owning transaction.
   */
  runtimeExecutionCounts() {
    const row = this.#database.prepare(
      "SELECT COUNT(*) AS records, COALESCE(SUM(count), 0) AS events FROM runtime WHERE kind='runtime-execution'"
    ).get();
    return { records: Number(row?.records ?? 0), events: Number(row?.events ?? 0) };
  }
  /**
   * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
   * is reported as a warning, never as a failed import that could cause an unsafe retry.
   * @param {string} directory Project root for the watcher hint.
   */
  writePointer(directory) {
    const temporary = import_node_path4.default.join(directory, `.analysis.json.${(0, import_node_crypto4.randomUUID)()}.tmp`);
    try {
      this.transaction(() => {
        import_node_fs4.default.writeFileSync(temporary, canonicalJson(this.manifest()), { flag: "wx" });
        import_node_fs4.default.renameSync(temporary, import_node_path4.default.join(directory, ANALYSIS_PROJECT_MANIFEST));
      });
    } catch (error) {
      process.emitWarning(
        `Analysis database committed, but its watcher pointer could not be refreshed: ${String(error)}`
      );
    } finally {
      try {
        import_node_fs4.default.rmSync(temporary, { force: true });
      } catch {
      }
    }
  }
  /** Checkpoint and reclaim unused SQLite pages. Run only during explicit storage maintenance. */
  compact() {
    const disk = import_node_fs4.default.statfsSync(import_node_path4.default.dirname(this.file));
    const pageCount = Number(this.#database.prepare("PRAGMA page_count").get()?.page_count);
    const pageSize = Number(this.#database.prepare("PRAGMA page_size").get()?.page_size);
    if (disk.bavail * disk.bsize < 2 * pageCount * pageSize) {
      throw new Error(
        "Insufficient free disk space for SQLite VACUUM. Allow twice the database size."
      );
    }
    this.transaction(() => {
      collectRuntimeHistory(this.#database);
      this.#database.exec(`
        DELETE FROM runtime_prefixes WHERE id NOT IN (SELECT DISTINCT prefix_id FROM runtime);
        DELETE FROM runtime_evidence WHERE id NOT IN (SELECT DISTINCT evidence_id FROM runtime);
      `);
    });
    this.#database.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
  }
  /** Current persisted policy. Defaults do not write or change the semantic revision.
   * @returns {AnalysisStoragePolicy} Validated defaults and persisted overrides.
   */
  storagePolicy() {
    return readStoragePolicy(this.#database);
  }
  /** Update only explicit policy fields in the caller's writer transaction.
   * @param {Partial<AnalysisStoragePolicy>} patch Explicit limits, in bytes/days/counts.
   * @returns {AnalysisStoragePolicy} Complete policy saved without changing the edit revision.
   */
  setStoragePolicy(patch) {
    this.#requireTransaction();
    const policy = validateStoragePolicy({ ...this.storagePolicy(), ...patch });
    this.#database.prepare("INSERT OR REPLACE INTO meta VALUES('storage-policy',?)").run(JSON.stringify(policy));
    return policy;
  }
  /** Storage accounting avoids decoding runtime or analysis payloads.
   * @returns {object} Physical allocation and logical retention counts.
   */
  storageSnapshot() {
    return storageSnapshot(this.#database, this.file);
  }
  /** Optional projection allocation, including secondary indexes. Reserved for explicit accounting.
   * @returns {number} Allocated cache bytes, excluding permanent editor/export indexes.
   */
  storageCacheBytes() {
    return optionalCacheBytes(this.#database);
  }
  /** Durable receipt lookup survives source-file removal and cache eviction.
   * @param {string} sha256 Canonical capture identity.
   * @returns {object | undefined} Retained import identity and counts.
   */
  captureReceipt(sha256) {
    return this.#database.prepare("SELECT * FROM capture_catalog WHERE sha256=?").get(sha256);
  }
  /** Bounded physical-code joins; graphics never imply that a CPU instruction executed. */
  graphicsEvidence(query) {
    return this.transaction(() => queryGraphicsEvidence(this.#database, query), false);
  }
  /** Small durable import receipts in import order. */
  captureCatalog() {
    return this.#database.prepare("SELECT * FROM capture_catalog ORDER BY imported_at,sha256").all();
  }
  /** Record the first successful import atomically with its facts. Reimports only refresh last-seen time.
   * @param {ImportReport} report Successfully validated native trace import.
   */
  recordCaptureReceipt(report) {
    this.#requireTransaction();
    if (!["uttori-asm-instruction-trace", "uttori-asm-bus-trace", "uttori-nes-ppu-evidence"].includes(
      report.format
    )) {
      return;
    }
    const now = Date.now();
    this.#database.prepare(`INSERT INTO capture_catalog(sha256,profile,source_name,imported_at,last_seen_at,observed_events,dropped_events)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO UPDATE SET last_seen_at=excluded.last_seen_at`).run(
      report.sourceSha256,
      report.indexProfile ?? "full",
      report.sourceName,
      now,
      now,
      observedImportCount(report.imported, "graphicsEvents") ?? observedImportCount(report.imported, "busEvents") ?? observedImportCount(report.imported, "executionEvents") ?? 0,
      report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0
    );
  }
  /** Drop disposable projections after publication, then recycle WAL without waiting on active readers.
   * @returns {object} Cache eviction totals and whether readers delayed WAL truncation.
   */
  maintainStorage() {
    const caches = this.transaction(() => maintainStorageCaches(this.#database));
    const previousTimeout = Number(this.#database.prepare("PRAGMA busy_timeout").get().timeout);
    try {
      this.#database.exec("PRAGMA busy_timeout=0; PRAGMA wal_checkpoint(PASSIVE)");
      const checkpoint = this.#database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
      return { ...caches, checkpointBusy: Number(checkpoint?.busy ?? 0) !== 0 };
    } finally {
      this.#database.exec(`PRAGMA busy_timeout=${previousTimeout}`);
    }
  }
  /** Close once in finally, releasing statements and any active transaction. Further use throws. */
  close() {
    this.#database.close();
  }
};

// packages/disassembler/src/project/project-store.ts
var fs5 = __toESM(require("node:fs"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);
function isUntrustedManifest(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var parseAnalysisProjectManifest = (input) => {
  if (!isUntrustedManifest(input)) {
    throw new Error("Invalid analysis project manifest.");
  }
  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion > 3) {
    throw new Error(
      `Analysis project schema ${schemaVersion} is newer than supported schema 3. Refusing to downgrade.`
    );
  }
  validateAnalysisProjectManifest(input);
  if (input.db !== "analysis.sqlite") {
    throw new Error("Legacy analysis storage is no longer supported. Use a SQLite project.");
  }
  return input;
};
var openAnalysisProjectStore = (directory) => {
  let pointer;
  try {
    pointer = fs5.readFileSync(import_node_path5.default.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    const store = new SqliteAnalysisStore(analysisProjectSqlitePath(directory, {}), false);
    try {
      parseAnalysisProjectManifest(store.manifest());
      store.writePointer(directory);
      return store;
    } catch (recoveryError) {
      store.close();
      throw recoveryError;
    }
  }
  const manifest = parseAnalysisProjectManifest(JSON.parse(pointer));
  return new SqliteAnalysisStore(analysisProjectSqlitePath(directory, manifest), false);
};

// packages/disassembler/src/project/capture-notes.ts
var import_node_fs5 = __toESM(require("node:fs"), 1);
var import_node_path6 = __toESM(require("node:path"), 1);
function notesPath(directory, sha256) {
  if (!/^[\da-f]{64}$/.test(sha256)) {
    throw new Error("Invalid capture notes identity.");
  }
  return import_node_path6.default.join(directory, "capture-notes", `${sha256}.json`);
}
function isRecord9(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStrings(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isAddedCode(value) {
  return isRecord9(value) && typeof value.start === "number" && Number.isSafeInteger(value.start) && value.start >= 0 && typeof value.end === "number" && Number.isSafeInteger(value.end) && value.end > value.start && typeof value.addressSpace === "string" && typeof value.address === "number" && Number.isSafeInteger(value.address) && value.address >= 0 && isStrings(value.recordIds);
}
function isCaptureImportNotes(value) {
  if (!isRecord9(value) || value.format !== "uttori-capture-notes" || value.version !== 1 || typeof value.sourceSha256 !== "string" || typeof value.sourceName !== "string" || typeof value.importedAt !== "number" || !Number.isFinite(value.importedAt) || !isStrings(value.notes)) {
    return false;
  }
  const analysis = value.analysis;
  return analysis === void 0 || isRecord9(analysis) && (analysis.status === "complete" || analysis.status === "incomplete") && isStrings(analysis.sources) && Array.isArray(analysis.addedCode) && analysis.addedCode.every(isAddedCode);
}
function readCaptureImportNotes(directory, sha256) {
  const file = notesPath(directory, sha256);
  if (!import_node_fs5.default.existsSync(file)) {
    return void 0;
  }
  const stat = import_node_fs5.default.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) {
    throw new Error("Capture notes exceed their 16 MiB regular-file budget.");
  }
  const notes = JSON.parse(import_node_fs5.default.readFileSync(file, "utf8"));
  if (!isCaptureImportNotes(notes) || notes.sourceSha256 !== sha256) {
    throw new Error("Invalid capture import notes.");
  }
  return notes;
}

// packages/disassembler/src/source-project/project.ts
var import_node_fs6 = __toESM(require("node:fs"), 1);
var import_node_path7 = __toESM(require("node:path"), 1);
function isUnknownArray3(value) {
  return Array.isArray(value);
}
function isRecord10(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeInteger7(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function assertSourceProjectConfiguration(value) {
  if (!isRecord10(value)) {
    throw new Error("Invalid Git source project configuration.");
  }
  const id = value.id;
  const target = value.target;
  const romSha256 = value.romSha256;
  const sourceRoots = value.sourceRoots;
  const researchRoots = value.researchRoots;
  if (value.format !== "uttori-source-project" || value.version !== 1 || typeof id !== "string" || !/^[\w.-]+$/.test(id) || typeof target !== "string" || target === "" || typeof romSha256 !== "string" || !/^[\da-f]{64}$/.test(romSha256) || !isUnknownArray3(sourceRoots) || sourceRoots.length === 0 || !isUnknownArray3(researchRoots) || researchRoots.length === 0) {
    throw new Error("Invalid Git source project configuration.");
  }
  for (const name2 of [
    ...sourceRoots,
    ...researchRoots,
    value.buildConfig,
    value.layout,
    value.captures
  ]) {
    if (typeof name2 !== "string") {
      throw new Error("Source project paths must be strings.");
    }
    assertSourcePath(name2);
  }
  if (value.limits !== void 0) {
    if (!isRecord10(value.limits)) {
      throw new Error("Source work limits must be an object.");
    }
    for (const [name2, limit] of Object.entries(value.limits)) {
      if (name2 !== "captureBytes" && name2 !== "analysisWorkItems" && name2 !== "analysisCallDepth" && !RESEARCH_INPUT_LIMIT_NAMES.some((field) => field === name2) || !(isSafeInteger7(limit) && limit >= (name2 === "analysisCallDepth" ? 0 : 1))) {
        throw new Error(
          `Invalid source work limit limits.${name2} in .uttori/project.json. Use a positive safe integer; analysisCallDepth also accepts zero. Supported fields: captureBytes, analysisWorkItems, analysisCallDepth, ${RESEARCH_INPUT_LIMIT_NAMES.join(", ")}.`
        );
      }
    }
  }
}
function parseSourceProject(value) {
  assertSourceProjectConfiguration(value);
  return value;
}
function assertSourceProjectLocalInputs(value) {
  if (!isRecord10(value) || value.format !== "uttori-source-local" || value.version !== 1 || typeof value.rom !== "string" || value.rom === "" || typeof value.evidence !== "string" || value.evidence === "") {
    throw new Error(
      "Configure the local ROM and evidence paths before running this source project."
    );
  }
}
function readSourceProjectLocalInputs(root) {
  const local = JSON.parse(
    import_node_fs6.default.readFileSync(import_node_path7.default.join(root, ".uttori-local/project.json"), "utf8")
  );
  assertSourceProjectLocalInputs(local);
  return {
    ...local,
    rom: import_node_path7.default.resolve(root, local.rom),
    evidence: import_node_path7.default.resolve(root, local.evidence)
  };
}

// packages/vscode-extension/src/editor-info/format.ts
init_canonical_json();
var informationHex = (value, digits = 4) => {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toString(16).toUpperCase().padStart(digits, "0")}`;
};
var clip = (value, maximum) => value.length <= maximum ? value : `${value.slice(0, maximum - 1)}\u2026`;
function isRecord11(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonText(value) {
  if (value === void 0 || typeof value === "function" || typeof value === "symbol") {
    return void 0;
  }
  return JSON.stringify(value);
}
var stateValue = (value, present = true, includeStructures = false) => {
  if (!present) {
    return "\u2205";
  }
  if (isRecord11(value)) {
    if (value.kind === "known" && "value" in value) {
      return stateValue(value.value, true, includeStructures);
    }
    if (value.kind === "unknown") {
      return "?";
    }
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? informationHex(value) : String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (!includeStructures) {
    return void 0;
  }
  const serialized = jsonText(canonicalValue(value)) ?? String(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}\u2026` : serialized;
};
var joinInformation = (parts, separator, maximum) => clip(parts.filter(Boolean).join(separator), maximum);
var effectiveAddressText = (address) => {
  const resolved = address.address ?? address.baseAddress;
  const identity = [address.symbol, resolved === void 0 ? void 0 : informationHex(resolved)].filter((value) => value !== void 0).join("@");
  return `EA${address.operandIndex} ${identity || "?"}${address.address === void 0 && address.baseAddress !== void 0 ? " base" : ""}${address.volatile ? " volatile" : ""}`;
};
var transitionText = (transition) => `\u0394${transition.field} ${stateValue(transition.before, "before" in transition, true)}\u2192${stateValue(transition.after, "after" in transition, true)}`;
var stateText = (observation) => {
  const fields = Object.entries(observation.state).toSorted(([left], [right]) => left.localeCompare(right)).map(([name2, value]) => `${name2}=${stateValue(value, true, true)}`).join(",");
  return `${observation.source} state ${fields || "\u2205"}${observation.count === void 0 ? "" : ` \xD7${observation.count}`}`;
};
var accessText = (access) => {
  let mode = "?";
  if (access.access === "read") {
    mode = "R";
  } else if (access.access === "write") {
    mode = "W";
  } else if (access.access === "read-write") {
    mode = "RW";
  }
  let actor = "";
  if (access.actor) {
    actor = access.actor;
    if (access.channel !== void 0) {
      actor += ` channel ${access.channel}`;
    }
    actor += " ";
  }
  const value = access.value === void 0 ? "" : `=${informationHex(access.value)}`;
  return `${actor}${mode} ${access.accessedAddressSpace}:${informationHex(access.accessedAddress)}${value} ${access.width}B \xD7${access.count}`;
};
var formatInstructionAnnotationSummary = (annotation, maximumLength = 220) => {
  const parts = [];
  parts.push(...(annotation.comments ?? []).slice(0, 2).map(({ text }) => text));
  if (annotation.executionCount > 0) {
    parts.push(`\u25B6 ${annotation.executionCount}\xD7`);
  }
  if (annotation.detailsLimited) {
    parts.push("details limited");
  }
  const coverage = annotation.runtimeCoverage.map(({ coverage: kind }) => kind);
  if (coverage.length > 0) {
    parts.push(`coverage ${coverage.join("/")}`);
  }
  parts.push(...annotation.effectiveAddresses.slice(0, 2).map(effectiveAddressText));
  parts.push(...annotation.memoryAccesses.slice(0, 2).map(accessText));
  parts.push(...annotation.stateTransitions.slice(0, 3).map(transitionText));
  if (annotation.stateTransitions.length === 0 && annotation.stateObservations.length > 0) {
    parts.push(stateText(annotation.stateObservations[0]));
  }
  return joinInformation(parts, " \xB7 ", Math.max(24, maximumLength));
};

// packages/vscode-extension/src/analysis/annotation-index.ts
var append2 = (map, key3, value) => {
  const entries = map.get(key3);
  if (entries) {
    entries.push(value);
  } else {
    map.set(key3, [value]);
  }
};
var lowerBound2 = (values, target, at) => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (at(values[middle]) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};
var valuesInRange = (values, start, end, at) => {
  const matches = [];
  for (let index = lowerBound2(values, start, at); index < values.length && at(values[index]) < end; index++) {
    matches.push(values[index]);
  }
  return matches;
};
var createInstructionAnnotationIndex = (instructions) => {
  const byAddressSpace = /* @__PURE__ */ new Map();
  const byOutputOffset = [];
  for (const annotation of instructions) {
    append2(byAddressSpace, annotation.addressSpace, annotation);
    for (const offset of annotation.outputOffsets) {
      byOutputOffset.push({ offset, annotation });
    }
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
      ({ address }) => address
    ),
    ...range.outputStart === void 0 || range.outputEnd === void 0 ? [] : valuesInRange(
      index.byOutputOffset,
      range.outputStart,
      range.outputEnd,
      ({ offset }) => offset
    ).map(({ annotation }) => annotation)
  ];
  const unique2 = new Map(
    matches.filter(
      (annotation) => annotation.architectures.length === 0 || annotation.architectures.includes(range.architecture)
    ).map((annotation) => [annotation.id, annotation])
  );
  return [...unique2.values()].toSorted(
    (left, right) => left.addressSpace.localeCompare(right.addressSpace) || left.address - right.address || left.id.localeCompare(right.id)
  );
};

// packages/vscode-extension/src/analysis/navigation-data.ts
var projectAnalysisNavigation = (project, target, executionCounts) => {
  if (project.manifest.target !== target.target || project.manifest.rom.contentSha256 !== target.romContentSha256 || project.manifest.rom.contentSize !== target.romContentSize) {
    throw new Error("Navigation target no longer matches the current native analysis project.");
  }
  const matchesArchitecture = (specification) => !target.architectureHints.length || target.architectureHints.some(
    (architecture) => specification === architecture || specification.startsWith(`${architecture}.`)
  );
  const nodes = project.shards.analysis.filter(
    (record2) => record2.kind === "cfg-node" && record2.addressSpace === target.addressSpace && matchesArchitecture(record2.specificationId)
  ).toSorted((a, b) => a.address - b.address || a.id.localeCompare(b.id));
  let index = nodes.findIndex(({ address }) => address >= target.address);
  if (index < 0) {
    index = Math.max(0, nodes.length - 1);
  }
  const visible = nodes.slice(Math.max(0, index - 4), Math.max(0, index - 4) + 32);
  const addresses = /* @__PURE__ */ new Set([...visible.map(({ address }) => address), target.address]);
  const offsets = new Set(
    visible.flatMap((node) => node.fileOffset === void 0 ? [] : [node.fileOffset])
  );
  const fileSpaces = new Set(
    project.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
  );
  const addressList = [...addresses];
  const offsetList = [...offsets];
  const locations = (space) => {
    if (space === target.addressSpace) {
      return addressList;
    }
    return fileSpaces.has(space) ? offsetList : [];
  };
  const runtime = project.shards.runtime.filter((record2) => {
    if (!matchesArchitecture(record2.architecture)) {
      return false;
    }
    if (record2.kind === "runtime-memory-access") {
      return record2.instructionAddressSpace === target.addressSpace && addresses.has(record2.instructionAddress);
    }
    if (record2.kind === "runtime-control-target") {
      return record2.fromAddressSpace === target.addressSpace && addresses.has(record2.fromAddress);
    }
    if (record2.kind === "runtime-coverage") {
      return locations(record2.addressSpace).some(
        (address) => record2.start <= address && address < record2.end
      );
    }
    return record2.addressSpace === target.addressSpace && addresses.has(record2.address);
  });
  const projection = buildInstructionAnalysisAnnotations(project.manifest, {
    ...project.shards,
    analysis: visible,
    runtime,
    annotations: project.shards.annotations.filter(
      (record2) => locations(record2.addressSpace).some(
        (address) => record2.start <= address && address < record2.end
      )
    )
  });
  const summaries = new Map(
    projection.instructions.filter((record2) => record2.addressSpace === target.addressSpace).map((record2) => [
      record2.address,
      formatInstructionAnnotationSummary({
        ...record2,
        executionCount: executionCounts?.get(`${record2.addressSpace}:${record2.address}`) ?? record2.executionCount
      })
    ])
  );
  const lines = visible.map((node) => {
    const bytes = (node.bytes ? node.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")) : [
      node.opcode.toString(16).toUpperCase().padStart(2, "0"),
      ...Array.from({ length: Math.max(0, node.size - 1) }, () => "??")
    ]).join(" ");
    const summary = summaries.get(node.address);
    const context = node.context.length ? ` context=${node.context.map((value) => `0x${value.toString(16)}`).join("/")}` : "";
    return `${node.addressSpace}|0x${node.address.toString(16)}  ${bytes.padEnd(16)}  ${node.mnemonic} <${node.mode}> ; ${node.id}${context}${summary ? ` ; ${summary}` : ""}`;
  });
  const captured = runtime.filter(
    (record2) => record2.kind === "runtime-instruction" && record2.address === target.address
  ).slice(0, 32);
  if (captured.length) {
    lines.push(
      "; Saved execution-time instruction variants at the selected address:",
      ...captured.map(
        (record2) => `${record2.addressSpace}|0x${record2.address.toString(16)}  ${record2.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")} ; ${record2.architecture} \xB7 recorded ${record2.count} time(s)`
      )
    );
  }
  return {
    lines,
    capturedRam: visible.some(
      (node) => node.address === target.address && node.fileOffset === void 0 && !!node.bytes
    ) || captured.length > 0 && !visible.some((node) => node.address === target.address && node.fileOffset !== void 0)
  };
};

// packages/vscode-extension/src/analysis/research-context.ts
var import_node_fs7 = __toESM(require("node:fs"), 1);
var import_node_path8 = __toESM(require("node:path"), 1);
function readConfiguration(file) {
  if (import_node_fs7.default.statSync(file).size > 1024 * 1024) {
    throw new Error(`Source project configuration exceeds 1 MiB: ${file}`);
  }
  return JSON.parse(import_node_fs7.default.readFileSync(file, "utf8"));
}
function analysisResearchContext(directory, preferredRoot) {
  const evidence = import_node_fs7.default.realpathSync(directory);
  const inspect = (root) => {
    const file = import_node_path8.default.join(root, ".uttori/project.json");
    if (!import_node_fs7.default.existsSync(file)) {
      return void 0;
    }
    const configuration = parseSourceProject(readConfiguration(file));
    const local = readSourceProjectLocalInputs(root);
    if (import_node_fs7.default.realpathSync(local.evidence) !== evidence) {
      return void 0;
    }
    return {
      root,
      snapshot: readResearchInputs(
        root,
        configuration.researchRoots,
        { project: configuration.id, romSha256: configuration.romSha256 },
        void 0,
        configuration.limits
      )
    };
  };
  if (preferredRoot) {
    const selected = inspect(import_node_path8.default.resolve(preferredRoot));
    if (selected) {
      return selected;
    }
  }
  for (let root = import_node_path8.default.resolve(directory); ; root = import_node_path8.default.dirname(root)) {
    const selected = inspect(root);
    if (selected) {
      return selected;
    }
    if (import_node_fs7.default.existsSync(import_node_path8.default.join(root, ".git")) || import_node_path8.default.dirname(root) === root) {
      return void 0;
    }
  }
}

// packages/vscode-extension/src/analysis/sources-data.ts
var readAnalysisSourceCatalog = (directory) => {
  const store = openAnalysisProjectStore(directory);
  try {
    return store.transaction(() => store.sourceCatalog(), false);
  } finally {
    store.close();
  }
};

// packages/vscode-extension/src/analysis/worker.ts
function isRecord12(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDebugMapRange(value) {
  return isRecord12(value) && typeof value.architecture === "string" && typeof value.addressSpace === "string" && typeof value.start === "number" && typeof value.end === "number" && typeof value.sourceId === "number" && typeof value.line === "number" && (value.outputStart === void 0 || typeof value.outputStart === "number") && (value.outputEnd === void 0 || typeof value.outputEnd === "number");
}
function debugMapRanges(values) {
  if (!values.every(isDebugMapRange)) {
    throw new Error("Invalid debug-map range.");
  }
  return values;
}
var database;
var projectDatabase = (directory) => {
  const stat = fs9.statSync(path9.join(directory, ANALYSIS_PROJECT_SQLITE_FILE), { bigint: true });
  const identity = `${stat.dev}:${stat.ino}`;
  if (database?.directory !== directory || database.identity !== identity) {
    database?.store.close();
    database = { directory, identity, store: openAnalysisProjectStore(directory) };
  }
  return database.store;
};
var projectRequest = (message) => {
  if (message.operation === "clear") {
    return void 0;
  }
  if (message.operation === "sources") {
    return readAnalysisSourceCatalog(message.directory);
  }
  const store = projectDatabase(message.directory);
  if (message.operation === "evidenceChoices") {
    return store.transaction(
      () => ({
        manifest: store.manifest(),
        shards: store.evidenceChoices(message.evidenceSelection)
      }),
      false
    );
  }
  if (message.operation === "explainEvidence") {
    if (!message.evidenceRecord) {
      throw new Error("Choose a record to explain.");
    }
    store.prepareSourceQueries();
    return store.explainEvidence(message.evidenceRecord.kind, message.evidenceRecord.id);
  }
  if (message.operation === "annotationSummary") {
    const supplied = message.ranges ?? [];
    if (!supplied.length) {
      return [];
    }
    if (supplied.length > 2e3) {
      throw new Error("At most 2000 visible source ranges may be projected per request.");
    }
    const ranges = debugMapRanges(supplied);
    store.prepareAnnotationQueries();
    return store.transaction(() => store.instructionExecutionSummary(ranges), false);
  }
  if (message.operation === "annotations" || message.operation === "debugAnnotations") {
    const supplied = message.ranges ?? [];
    if (!supplied.length) {
      return [];
    }
    if (supplied.length > 2e3) {
      throw new Error("At most 2000 visible source ranges may be projected per request.");
    }
    const ranges = debugMapRanges(supplied);
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const manifest2 = store.manifest();
      const view = store.instructionAnnotationView(ranges);
      const instructions = buildInstructionAnalysisAnnotations(
        manifest2,
        view.shards
      ).instructions.map(
        (entry) => Object.assign(
          {},
          entry,
          {
            executionCount: view.executionCounts.get(`${entry.addressSpace}:${entry.address}`) ?? entry.executionCount
          },
          view.limited ? { detailsLimited: true } : {}
        )
      );
      const index = createInstructionAnnotationIndex(instructions);
      const output = [];
      for (const range of ranges) {
        for (const annotation of instructionAnnotationsForDebugRange(index, range)) {
          output.push({ line: range.line, annotation });
          if (output.length >= 2e3) {
            break;
          }
        }
        if (output.length >= 2e3) {
          break;
        }
      }
      if (message.operation === "debugAnnotations") {
        return [...new Map(output.map(({ annotation }) => [annotation.id, annotation])).values()].map((entry) => ({
          addressSpace: entry.addressSpace,
          address: entry.address,
          outputOffsets: entry.outputOffsets,
          architectures: entry.architectures,
          text: formatInstructionAnnotationSummary(entry)
        })).filter(({ text }) => text);
      }
      return output;
    }, false);
  }
  if (message.operation === "sourceNotes") {
    const source = store.transaction(
      () => store.sourceCatalog().sources.find(({ id }) => id === message.sourceId),
      false
    );
    if (!source) {
      throw new Error("Choose a source to inspect.");
    }
    return source.sha256 ? readCaptureImportNotes(message.directory, source.sha256) ?? null : null;
  }
  const manifest = store.transaction(() => store.manifest(), false);
  if (message.operation === "manifest") {
    return manifest;
  }
  if (message.operation === "navigation") {
    if (!message.navigationTarget) {
      throw new Error("Choose an analysis location.");
    }
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const target = message.navigationTarget;
      const analysis = store.navigationNodes(
        target.addressSpace,
        target.address,
        target.architectureHints
      );
      const ranges = analysis.flatMap((record2) => {
        if (record2.kind !== "cfg-node") {
          return [];
        }
        const outputRange = record2.fileOffset === void 0 ? {} : { outputStart: record2.fileOffset, outputEnd: record2.fileOffset + record2.size };
        return [
          {
            addressSpace: record2.addressSpace,
            start: record2.address,
            end: record2.address + record2.size,
            ...outputRange
          }
        ];
      });
      if (!ranges.some((range) => range.start === target.address)) {
        ranges.push({
          addressSpace: target.addressSpace,
          start: target.address,
          end: target.address + 1
        });
      }
      const view = store.instructionAnnotationView(ranges);
      return projectAnalysisNavigation(
        { manifest: store.manifest(), shards: { ...view.shards, analysis } },
        target,
        view.executionCounts
      );
    }, false);
  }
  if (message.operation === "coverage") {
    return store.coverageSummary();
  }
  if (message.operation === "coverageConflicts") {
    return store.coverageConflicts(message.offset);
  }
  throw new Error("Unknown analysis worker operation.");
};
var request = (message) => {
  if (message.operation === "clear") {
    return void 0;
  }
  const store = projectDatabase(message.directory);
  const research = analysisResearchContext(message.directory, message.sourceRoot);
  if (!research) {
    if (store.researchInputsIdentity()) {
      throw new Error("Select the Git source project before querying its research index.");
    }
    return projectRequest(message);
  }
  if (!store.researchInputsAreCurrent(research.snapshot.hash)) {
    const changed = store.transaction(() => store.synchronizeResearchInputs(research.snapshot));
    if (changed) {
      store.writePointer(message.directory);
    }
  }
  if (["coverage", "coverageConflicts", "annotations", "debugAnnotations", "navigation"].includes(
    message.operation
  )) {
    store.assertCurrentAnalysis();
  }
  const revision = store.revision();
  const value = projectRequest(message);
  const current = analysisResearchContext(message.directory, research.root);
  if (current?.snapshot.hash !== research.snapshot.hash || store.researchInputsIdentity() !== research.snapshot.hash || store.revision() !== revision) {
    throw new Error("Research inputs changed during this query. Retry with the selected branch.");
  }
  return value;
};
var send = (response) => {
  if (import_node_worker_threads.parentPort) {
    import_node_worker_threads.parentPort.postMessage(response);
  } else {
    process.send?.(response);
  }
};
var handleMessage = (message) => {
  try {
    const value = request(message);
    if (value instanceof Promise) {
      void value.then((result) => send({ id: message.id, value: result })).catch(
        (error) => send({ id: message.id, error: error instanceof Error ? error.message : String(error) })
      );
    } else {
      send({ id: message.id, value });
    }
  } catch (error) {
    send({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
  }
};
var runAnalysisWorkerRequest = request;
if (import_node_worker_threads.parentPort) {
  import_node_worker_threads.parentPort.on("message", handleMessage);
} else if (typeof process.send === "function") {
  process.on("message", handleMessage);
  process.on("disconnect", () => process.exit(0));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runAnalysisWorkerRequest
});

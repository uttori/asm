"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/vscode-extension/src/analysis-worker.ts
var analysis_worker_exports = {};
module.exports = __toCommonJS(analysis_worker_exports);
var import_node_worker_threads = require("node:worker_threads");
var fs3 = __toESM(require("node:fs"));
var path2 = __toESM(require("node:path"));

// packages/disassembler/src/analysis-graph.ts
var sortedUnique = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
var sortedUniqueNumbers = (values) => [...new Set(values)].sort((left, right) => left - right);
var addressKey = (addressSpace, address) => `${addressSpace}:${address}`;
var outputOffsetsFor = (nodeIds, nodesById) => sortedUniqueNumbers(
  nodeIds.flatMap((id) => {
    const node = nodesById.get(id);
    return node?.fileOffset === void 0 ? [] : [node.fileOffset];
  })
);
var buildAnalysisCallGraph = (shards) => {
  const nodes = shards.analysis.filter(
    (record) => record.kind === "cfg-node"
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const functionRecords = shards.analysis.filter(
    (record) => record.kind === "function"
  );
  const functionsByAddress = /* @__PURE__ */ new Map();
  for (const fn of functionRecords) {
    const key = addressKey(fn.addressSpace, fn.address);
    functionsByAddress.set(key, [...functionsByAddress.get(key) ?? [], fn]);
  }
  const ownersByNode = /* @__PURE__ */ new Map();
  const ownerFunctionIds = (node) => {
    if (!node) return [];
    const cached = ownersByNode.get(node.id);
    if (cached) return cached;
    const path3 = node.evidencePath.length > 0 ? node.evidencePath : [node.id];
    for (let index = path3.length - 1; index >= 0; index--) {
      const candidate = nodesById.get(path3[index]);
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
  const append2 = (map, key, id) => {
    const entries = map.get(key);
    if (entries) entries.push(id);
    else map.set(key, [id]);
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

// packages/disassembler/src/coverage-map.ts
var CLASSIFICATION_ORDER = [
  "opcode",
  "operand",
  "data",
  "asset",
  "unknown"
];
var RUNTIME_ORDER = ["executed", "operand", "read", "written"];
var annotationClassification = (classification) => {
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
var compareStrings = (left, right) => left.localeCompare(right);
var arraysEqual = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
var segmentsEqual = (left, right) => left.status === right.status && arraysEqual(left.classifications, right.classifications) && arraysEqual(left.runtime, right.runtime) && arraysEqual(left.annotationIds, right.annotationIds) && arraysEqual(left.analysisIds, right.analysisIds) && arraysEqual(left.runtimeIds, right.runtimeIds) && arraysEqual(left.conflictIds, right.conflictIds) && arraysEqual(left.regionIds, right.regionIds);
var coverageAddressSpace = (record) => {
  if (record.kind === "runtime-coverage" || record.kind === "runtime-execution") {
    return record.addressSpace;
  }
  if (record.kind === "runtime-memory-access") return record.accessedAddressSpace;
  return void 0;
};
var buildRomCoverageMap = (manifest, shards) => {
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
      unprojected.push({ kind: "analysis", id: record.id, addressSpace: record.addressSpace, reason: "missing-file-offset" });
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
  const addRuntimeAddressSpaceOverlay = (record, runtime, start, end) => {
    const addressSpace = coverageAddressSpace(record);
    addAddressSpaceOverlay({ runtime, runtimeId: record.id }, start, end, {
      kind: "runtime",
      id: record.id,
      addressSpace
    });
  };
  for (const record of shards.runtime) {
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
      runtime: [...new Set(values.flatMap(({ runtime }) => runtime ? [runtime] : []))].sort(
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
    for (const runtime of segment.runtime) bytesByRuntimeCoverage[runtime] += size;
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

// packages/disassembler/src/trace-detail.ts
var isArray = (value) => Array.isArray(value);
var validateRuntimeInstructionDetails = (value, count) => {
  if (!Array.isArray(value) || value.length !== count)
    throw new Error("Trace details must align one-to-one with instruction addresses.");
  return value.map((detail) => {
    if (!detail || !isArray(detail.bytes) || detail.bytes.length < 1 || detail.bytes.length > 16 || detail.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255))
      throw new Error("Trace instruction bytes must contain 1\u201316 byte values.");
    if (!detail.state || typeof detail.state !== "object" || isArray(detail.state) || Object.entries(detail.state).some(
      ([key, entry]) => !key || !["number", "string", "boolean"].includes(typeof entry) || typeof entry === "number" && !Number.isFinite(entry)
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

// packages/disassembler/src/project-store.ts
var import_node_crypto2 = require("node:crypto");
var fs2 = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);

// packages/disassembler/src/json-array-file.ts
var fs = __toESM(require("node:fs"), 1);
var import_node_crypto = require("node:crypto");
var import_node_string_decoder = require("node:string_decoder");
var readObjectArrayFile = (file, expectedSha256) => {
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const decoder = new import_node_string_decoder.StringDecoder("utf8");
  const hash = (0, import_node_crypto.createHash)("sha256");
  const records = [];
  let mode = "start";
  let allowEnd = true;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let parts = [];
  let recordLength = 0;
  const fail = () => {
    throw new Error(`Analysis shard '${file}' is not a valid JSON object-record array.`);
  };
  const consume = (text) => {
    let recordStart = mode === "record" ? 0 : -1;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (mode === "record") {
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
        } else if (char === '"') inString = true;
        else if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") {
          depth--;
          if (depth === 0) {
            const tail = text.slice(recordStart, index + 1);
            recordLength += tail.length;
            if (recordLength > 32 * 1024 * 1024)
              throw new Error("Analysis shard record exceeds the 32 MiB limit.");
            parts.push(tail);
            records.push(JSON.parse(parts.join("")));
            parts = [];
            recordLength = 0;
            recordStart = -1;
            mode = "comma";
          }
        }
        continue;
      }
      if (char === " " || char === "\n" || char === "\r" || char === "	") continue;
      if (mode === "start" && char === "[") {
        mode = "value";
        continue;
      }
      if (mode === "value") {
        if (char === "]" && allowEnd) {
          mode = "end";
          continue;
        }
        if (char !== "{") fail();
        mode = "record";
        recordStart = index;
        depth = 1;
        continue;
      }
      if (mode === "comma" && char === ",") {
        mode = "value";
        allowEnd = false;
        continue;
      }
      if (mode === "comma" && char === "]") {
        mode = "end";
        continue;
      }
      fail();
    }
    if (recordStart >= 0) {
      const tail = text.slice(recordStart);
      parts.push(tail);
      recordLength += tail.length;
      if (recordLength > 32 * 1024 * 1024)
        throw new Error("Analysis shard record exceeds the 32 MiB limit.");
    }
  };
  try {
    let count;
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      const bytes = buffer.subarray(0, count);
      hash.update(bytes);
      consume(decoder.write(bytes));
    }
    consume(decoder.end());
    if (String(mode) !== "end") fail();
    if (hash.digest("hex") !== expectedSha256)
      throw new Error(`Analysis shard '${file}' does not match its SHA-256.`);
    return records;
  } finally {
    fs.closeSync(descriptor);
  }
};

// packages/disassembler/src/project-types.ts
var ANALYSIS_PROJECT_FORMAT = "uttori-asm-analysis";
var ANALYSIS_PROJECT_SCHEMA_VERSION = 2;
var ANALYSIS_PROJECT_MANIFEST = "analysis.json";

// packages/disassembler/src/project-store.ts
var SHARD_PATHS = Object.freeze({
  analysis: "analysis/control-flow.json",
  annotations: "analysis/annotations.json",
  labels: "analysis/labels.json",
  comments: "analysis/comments.json",
  regions: "analysis/regions.json",
  runtime: "analysis/runtime.json",
  evidence: "analysis/evidence.json",
  imports: "analysis/imports.json"
});
var sha256 = (value) => (0, import_node_crypto2.createHash)("sha256").update(value).digest("hex");
var assertSafeRelativePath = (relative) => {
  if (relative === "" || import_node_path.default.isAbsolute(relative) || relative.split(/[/\\]/).some((part) => part === "..")) {
    throw new Error(`Unsafe project shard path '${relative}'.`);
  }
};
var validateAnalysisProjectManifest = (manifest) => {
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
  const shardIds = /* @__PURE__ */ new Set();
  const shardPaths = /* @__PURE__ */ new Set();
  for (const shard of manifest.shards) {
    assertSafeRelativePath(shard.path);
    if (!(shard.kind in SHARD_PATHS))
      throw new Error(`Unknown analysis shard kind '${shard.kind}'.`);
    if (!/^[\da-f]{64}$/.test(shard.sha256)) {
      throw new Error(`Analysis shard '${shard.id}' has an invalid SHA-256.`);
    }
    if (!Number.isSafeInteger(shard.records) || shard.records < 0) {
      throw new Error(`Analysis shard '${shard.id}' has an invalid record count.`);
    }
    if (shardIds.has(shard.id)) throw new Error(`Duplicate analysis shard id '${shard.id}'.`);
    if (shardPaths.has(shard.path))
      throw new Error(`Duplicate analysis shard path '${shard.path}'.`);
    shardIds.add(shard.id);
    shardPaths.add(shard.path);
  }
};
var FORBIDDEN_ROM_PAYLOAD_KEYS = /* @__PURE__ */ new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);
var assertNoRomPayload = (value, location) => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      assertNoRomPayload(value[index], `${location}[${index}]`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key)) {
      throw new Error(`ROM byte payload '${location}.${key}' is forbidden in analysis projects.`);
    }
    assertNoRomPayload(entry, `${location}.${key}`);
  }
};
var isStableId = (id) => {
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
  const visitJson = (value, current2) => {
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitJson(entry, `${current2}[${index}]`));
      return;
    }
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      Object.entries(value).forEach(([key, entry]) => visitJson(entry, `${current2}.${key}`));
      return;
    }
    throw new Error(`${current2} is not a JSON-safe codec option.`);
  };
  if (reference.options !== void 0) visitJson(reference.options, `${location} options`);
};
var validateLoadedShards = (shards, project) => {
  const { addressSpaces } = project;
  const evidenceIds = new Set(shards.evidence.map((record) => record.id));
  for (const [kind, records] of Object.entries(shards)) {
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
  for (const record of shards.runtime) {
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
    if (parent.addressSpace === region.addressSpace && (region.start < parent.start || region.end > parent.end)) {
      throw new Error(
        `Analysis region '${region.id}' is not contained by parent region '${parent.id}'.`
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
    ...shards.runtime.filter(
      (record) => "addressSpace" in record
    ),
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
    const addresses = [];
    if ("start" in record) {
      addresses.push(record.start, record.end - 1);
    } else if ("address" in record) {
      addresses.push(record.address);
      if ("kind" in record && record.kind === "conflict" && record.end !== void 0) {
        addresses.push(record.end - 1);
      }
    } else {
      if ("fromAddress" in record) addresses.push(record.fromAddress);
      if ("toAddress" in record && record.toAddress !== void 0) addresses.push(record.toAddress);
      if ("targets" in record) addresses.push(...record.targets);
    }
    if (addresses.some(
      (address) => !Number.isSafeInteger(address) || address < 0 || address >= maximum
    )) {
      throw new Error(
        `Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`
      );
    }
  }
  for (const record of shards.runtime) {
    let addresses = [];
    if (record.kind === "runtime-memory-access") {
      addresses = [
        [record.instructionAddressSpace, record.instructionAddress],
        [record.accessedAddressSpace, record.accessedAddress]
      ];
    } else if (record.kind === "runtime-control-target") {
      addresses = [
        [record.fromAddressSpace, record.fromAddress],
        [record.toAddressSpace, record.toAddress]
      ];
    }
    for (const [spaceId, address] of addresses) {
      const addressSpace = addressSpaceById.get(spaceId);
      if (!addressSpace) {
        throw new Error(
          `Runtime record '${record.id}' refers to unknown address space '${spaceId}'.`
        );
      }
      if (!Number.isSafeInteger(address) || address < 0 || address >= 2 ** addressSpace.addressBits) {
        throw new Error(`Runtime record '${record.id}' exceeds address space '${spaceId}'.`);
      }
    }
  }
  assertNoRomPayload(shards, "shards");
};
var migrateManifest = (input) => {
  if (!input || typeof input !== "object") throw new Error("Invalid analysis project manifest.");
  const version = input.schemaVersion;
  if (version === 0) {
    const legacy = input;
    const headerSize = legacy.headerSize ?? 0;
    const migrated = {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: legacy.target,
      rom: {
        sha256: legacy.romHash,
        contentSha256: legacy.romHash,
        fileSize: legacy.romSize + headerSize,
        contentSize: legacy.romSize,
        headerSize
      },
      mapping: { mapper: legacy.mapper, source: "override", candidates: [] },
      addressSpaces: [],
      shards: []
    };
    validateAnalysisProjectManifest(migrated);
    return migrated;
  }
  if (version === 1) {
    const migrated = {
      ...input,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION
    };
    validateAnalysisProjectManifest(migrated);
    return migrated;
  }
  if (typeof version !== "number") throw new Error("Manifest schemaVersion is required.");
  if (version > ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Analysis project schema ${version} is newer than supported schema ${ANALYSIS_PROJECT_SCHEMA_VERSION}; refusing to downgrade.`
    );
  }
  if (version < 0 || version !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
    throw new Error(`No migration exists for analysis project schema ${version}.`);
  }
  const manifest = input;
  validateAnalysisProjectManifest(manifest);
  return manifest;
};
var loadAnalysisProject = (directory) => {
  const manifestFile = import_node_path.default.join(directory, ANALYSIS_PROJECT_MANIFEST);
  const manifest = migrateManifest(JSON.parse(fs2.readFileSync(manifestFile, "utf8")));
  const loaded = {};
  for (const descriptor of manifest.shards) {
    assertSafeRelativePath(descriptor.path);
    const file = import_node_path.default.join(directory, descriptor.path);
    const records = fs2.statSync(file).size > 8 * 1024 * 1024 ? readObjectArrayFile(file, descriptor.sha256) : (() => {
      const text = fs2.readFileSync(file, "utf8");
      if (sha256(text) !== descriptor.sha256)
        throw new Error(`Analysis shard '${descriptor.path}' does not match its SHA-256.`);
      return JSON.parse(text);
    })();
    if (!Array.isArray(records) || records.length !== descriptor.records) {
      throw new Error(
        `Analysis shard '${descriptor.path}' record count does not match its manifest.`
      );
    }
    if (loaded[descriptor.kind] !== void 0) {
      throw new Error(`Analysis project contains more than one '${descriptor.kind}' shard.`);
    }
    loaded[descriptor.kind] = records;
  }
  for (const kind of Object.keys(SHARD_PATHS)) {
    loaded[kind] ??= [];
  }
  const shards = loaded;
  validateLoadedShards(shards, manifest);
  return { manifest, shards };
};

// packages/disassembler/src/instruction-annotations.ts
var sortedStrings = (values) => values ? [...new Set(values)].sort((left, right) => left.localeCompare(right)) : [];
var sortedNumbers = (values) => values ? [...new Set(values)].sort((left, right) => left - right) : [];
var canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalValue(entry)])
    );
  }
  return value;
};
var valueKey = (value, present) => present ? JSON.stringify(canonicalValue(value)) : "<absent>";
var locationKey = (addressSpace, address) => `${addressSpace}:${address}`;
var addValue = (target, value) => {
  const values = target ?? /* @__PURE__ */ new Set();
  values.add(value);
  return values;
};
var addAll = (target, values) => {
  if (values.length === 0) return target;
  target ??= /* @__PURE__ */ new Set();
  for (const value of values) target.add(value);
  return target;
};
var numberField = (record, name) => {
  const value = record[name];
  return Number.isSafeInteger(value) && value >= 0 ? value : void 0;
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
var runtimeState = (record) => record.state;
var buildInstructionAnalysisAnnotations = (manifest, shards) => {
  const fileAddressSpaces = new Set(
    manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id)
  );
  const instructions = /* @__PURE__ */ new Map();
  const diagnostics = [];
  const ensure = (addressSpace, address) => {
    const key = locationKey(addressSpace, address);
    let instruction = instructions.get(key);
    if (!instruction) {
      instruction = {
        addressSpace,
        address,
        executionCount: 0
      };
      instructions.set(key, instruction);
    }
    return instruction;
  };
  const addStateObservation = (instruction, source, architecture, state, recordId, evidence, count) => {
    const key = `${source}:${architecture}:${JSON.stringify(canonicalValue(state))}`;
    const observations = instruction.stateObservations ??= /* @__PURE__ */ new Map();
    let observation = observations.get(key);
    if (!observation) {
      observation = {
        source,
        architecture,
        state,
        ...count === void 0 ? {} : { count: 0 },
        recordIds: /* @__PURE__ */ new Set(),
        evidence: /* @__PURE__ */ new Set()
      };
      observations.set(key, observation);
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
      const key = JSON.stringify(canonicalValue(value));
      const addresses = instruction.effectiveAddresses ??= /* @__PURE__ */ new Map();
      let entry = addresses.get(key);
      if (!entry) {
        entry = { value, nodeIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
        addresses.set(key, entry);
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
      if (valueKey(beforeValue, hasBefore) === valueKey(afterValue, hasAfter)) continue;
      const key = `${field}:${valueKey(beforeValue, hasBefore)}:${valueKey(afterValue, hasAfter)}`;
      const transitions = instruction.stateTransitions ??= /* @__PURE__ */ new Map();
      let transition = transitions.get(key);
      if (!transition) {
        transition = {
          field,
          ...hasBefore ? { before: beforeValue } : {},
          ...hasAfter ? { after: afterValue } : {},
          nodeIds: /* @__PURE__ */ new Set(),
          evidence: /* @__PURE__ */ new Set()
        };
        transitions.set(key, transition);
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
  for (const record of shards.runtime) {
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
      const key = JSON.stringify(canonicalValue(value));
      const accesses = instruction.memoryAccesses ??= /* @__PURE__ */ new Map();
      let access = accesses.get(key);
      if (!access) {
        access = { value, count: 0, recordIds: /* @__PURE__ */ new Set(), evidence: /* @__PURE__ */ new Set() };
        accesses.set(key, access);
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
    for (let index = lowerBound2(direct, start, ({ address }) => address); index < direct.length && direct[index].address < end; index++) {
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
  for (const record of shards.runtime) {
    if (record.kind !== "runtime-coverage") continue;
    coverageById.set(record.id, record);
    attachToRange(record.addressSpace, record.start, record.end, (instruction) => {
      instruction.architectures = addValue(instruction.architectures, record.architecture);
      instruction.coverageRecordIds = addValue(instruction.coverageRecordIds, record.id);
      instruction.evidence = addAll(instruction.evidence, record.evidence);
    });
  }
  const summaries = new Set(
    shards.analysis.filter((record) => record.kind === "summary").map(({ architecture }) => architecture)
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
      stateTransitions: [...instruction.stateTransitions?.values() ?? []].map(({ field, before, after, nodeIds, evidence }) => ({
        field,
        ...before === void 0 ? {} : { before },
        ...after === void 0 ? {} : { after },
        nodeIds: sortedStrings(nodeIds),
        evidence: sortedStrings(evidence)
      })).sort(
        (left, right) => left.field.localeCompare(right.field) || valueKey(left.before, "before" in left).localeCompare(
          valueKey(right.before, "before" in right)
        ) || valueKey(left.after, "after" in left).localeCompare(
          valueKey(right.after, "after" in right)
        )
      ),
      stateObservations: [...instruction.stateObservations?.values() ?? []].map(({ source, architecture, state, count, recordIds, evidence }) => ({
        source,
        architecture,
        state,
        ...count === void 0 ? {} : { count },
        recordIds: sortedStrings(recordIds),
        evidence: sortedStrings(evidence)
      })).sort(
        (left, right) => left.source.localeCompare(right.source) || left.architecture.localeCompare(right.architecture) || JSON.stringify(canonicalValue(left.state)).localeCompare(
          JSON.stringify(canonicalValue(right.state))
        )
      ),
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

// packages/disassembler/src/interval-index.ts
var HalfOpenIntervalIndex = class {
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

// packages/vscode-extension/src/analysis-annotation-index.ts
var append = (map, key, value) => {
  map.set(key, [...map.get(key) ?? [], value]);
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
      ({ address }) => address
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

// packages/vscode-extension/src/analysis-annotation-format.ts
var hexadecimal = (value) => `$${value.toString(16).toUpperCase().padStart(4, "0")}`;
var canonicalValue2 = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue2);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonicalValue2(entry)])
    );
  }
  return value;
};
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
  const serialized = JSON.stringify(canonicalValue2(value)) ?? String(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}\u2026` : serialized;
};
var effectiveAddressText = (address) => {
  const resolved = address.address ?? address.baseAddress;
  const identity = [address.symbol, resolved === void 0 ? void 0 : hexadecimal(resolved)].filter((value) => value !== void 0).join("@");
  return `EA${address.operandIndex} ${identity || "?"}${address.address === void 0 && address.baseAddress !== void 0 ? " base" : ""}${address.volatile ? " volatile" : ""}`;
};
var transitionText = (transition) => `\u0394${transition.field} ${valueText(transition.before, "before" in transition)}\u2192${valueText(transition.after, "after" in transition)}`;
var stateText = (observation) => {
  const fields = Object.entries(observation.state).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => `${name}=${valueText(value)}`).join(",");
  return `${observation.source} state ${fields || "\u2205"}${observation.count === void 0 ? "" : ` \xD7${observation.count}`}`;
};
var accessText = (access) => {
  let mode = "?";
  if (access.access === "read") mode = "R";
  else if (access.access === "write") mode = "W";
  else if (access.access === "read-write") mode = "RW";
  return `${access.actor ? `${access.actor}${access.channel === void 0 ? "" : ` channel ${access.channel}`} ` : ""}${mode} ${access.accessedAddressSpace}:${hexadecimal(access.accessedAddress)}${access.value === void 0 ? "" : `=${hexadecimal(access.value)}`} ${access.width}B \xD7${access.count}`;
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

// packages/vscode-extension/src/analysis-worker.ts
var current;
var request = (message) => {
  if (message.operation === "clear") {
    current = void 0;
    return void 0;
  }
  const revision = fs3.readFileSync(path2.join(message.directory, "analysis.json"), "utf8");
  if (message.operation === "manifest") return migrateManifest(JSON.parse(revision));
  if (!current || current.directory !== message.directory || current.revision !== revision)
    current = {
      directory: message.directory,
      revision,
      project: loadAnalysisProject(message.directory)
    };
  const { project } = current;
  if (["coverage", "segments", "details"].includes(message.operation)) {
    const map = current.coverage ??= buildRomCoverageMap(project.manifest, project.shards);
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
    const summaries = [
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
      const key = `${location.addressSpace}:${location.address}`;
      if (hints[key]) continue;
      const annotations = [
        ...indexes.get(location.addressSpace)?.at(location.address) ?? [],
        ...[...fileSpaces].flatMap(
          (space) => location.outputOffsets.flatMap((offset) => indexes.get(space)?.at(offset) ?? [])
        )
      ];
      const runtime = project.shards.runtime.filter(
        (record) => "addressSpace" in record && record.addressSpace === location.addressSpace && ("address" in record && record.address === location.address || record.kind === "runtime-coverage" && record.start <= location.address && location.address < record.end)
      );
      const architectures = [
        .../* @__PURE__ */ new Set([
          ...annotations.map(({ architecture }) => architecture),
          ...runtime.map(({ architecture }) => architecture)
        ])
      ];
      const fallback = summaries.length === 1 ? summaries : [];
      hints[key] = architectures.length ? architectures : fallback;
    }
    return { manifest: project.manifest, graph, hints };
  }
  if (message.operation === "annotations" && !message.ranges?.length) return [];
  current.instructions ??= buildInstructionAnalysisAnnotations(
    project.manifest,
    project.shards
  ).instructions;
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
import_node_worker_threads.parentPort?.on("message", (message) => {
  try {
    import_node_worker_threads.parentPort.postMessage({ id: message.id, value: request(message) });
  } catch (error) {
    import_node_worker_threads.parentPort.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

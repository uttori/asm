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

// src/editor-info/worker.ts
var import_node_worker_threads = require("node:worker_threads");

// src/editor-info/provider.ts
var import_node_crypto2 = require("node:crypto");
var import_promises = require("node:fs/promises");
var path = __toESM(require("node:path"), 1);

// ../core/src/debug-map.ts
var import_node_crypto = require("node:crypto");

// ../core/src/canonical-json.ts
var compareKeys = (a, b) => a.localeCompare(b);
var canonicalValue = (value) => {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  const input = value;
  const result = {};
  const keys = Object.keys(input);
  if (keys.length > 1) {
    keys.sort(compareKeys);
  }
  for (const key of keys) {
    const entry = input[key];
    if (entry === void 0) {
      continue;
    }
    const normalized = typeof entry === "object" && entry !== null ? canonicalValue(entry) : entry;
    if (key === "__proto__") {
      Object.defineProperty(result, key, {
        value: normalized,
        enumerable: true,
        writable: true,
        configurable: true
      });
    } else {
      result[key] = normalized;
    }
  }
  return result;
};
var canonicalJson = (value) => `${JSON.stringify(canonicalValue(value), void 0, 2)}
`;

// ../core/src/debug-map.ts
var DEBUG_MAP_FORMAT = "uttori-asm-debug-map";
var DEBUG_MAP_SCHEMA_VERSION = 1;
var sha256 = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var validateDebugMap = (map, output) => {
  const { fingerprint, ...payload } = map;
  const issues = [];
  if (map.format !== DEBUG_MAP_FORMAT) {
    issues.push(`Unsupported debug-map format '${String(map.format)}'.`);
  }
  if (map.schemaVersion !== DEBUG_MAP_SCHEMA_VERSION) {
    issues.push(`Unsupported debug-map schema ${String(map.schemaVersion)}.`);
  }
  const actualFingerprint = sha256(canonicalJson(payload));
  if (fingerprint.algorithm !== "sha256" || fingerprint.value !== actualFingerprint) {
    issues.push("Debug-map fingerprint mismatch.");
  }
  if (output) {
    if (output.length !== map.output.size) {
      issues.push("Debug-map output size mismatch.");
    }
    if (sha256(output) !== map.output.sha256) {
      issues.push("Debug-map output SHA-256 mismatch.");
    }
  }
  return issues;
};

// src/editor-info/provider.ts
var hash = (bytes) => (0, import_node_crypto2.createHash)("sha256").update(bytes).digest("hex");
var rangeKey = (range) => JSON.stringify(range);
var EditorInformationProvider = class {
  constructor(host2) {
    this.host = host2;
  }
  host;
  #artifacts;
  #projects;
  #epoch = 0;
  /** After settings change, each artifact must be rebuilt before its old interpretation is usable. */
  #currentConfigurationMaps;
  #extraMaps = /* @__PURE__ */ new Map();
  #summaries = /* @__PURE__ */ new Map();
  #details = /* @__PURE__ */ new Map();
  #pending = /* @__PURE__ */ new Map();
  #trackedFiles = /* @__PURE__ */ new Set();
  #trackedRevision = 0;
  /**
   * New successful build paths bypass workspace glob limits and invalidate old artifact facts.
   * @param {string} mapFile Debug map published atomically with a successful output.
   * @param {string} sourceRoot Root used to resolve portable source paths.
   */
  buildCompleted(mapFile, sourceRoot) {
    const file = path.resolve(mapFile);
    for (const [previous, roots] of this.#extraMaps) {
      if (roots.includes(sourceRoot)) {
        this.#extraMaps.delete(previous);
        this.#currentConfigurationMaps?.delete(previous);
      }
    }
    this.#currentConfigurationMaps?.add(file);
    this.#extraMaps.set(file, [sourceRoot]);
    while (this.#extraMaps.size > 16) {
      const oldest = this.#extraMaps.keys().next().value;
      this.#extraMaps.delete(oldest);
      this.#currentConfigurationMaps?.delete(oldest);
    }
    this.invalidate();
  }
  /** Hide artifacts produced under previous target/include/options settings until a successful build. */
  configurationChanged() {
    this.#currentConfigurationMaps = /* @__PURE__ */ new Set();
    this.invalidate();
  }
  /** Any changed dependency can alter layout elsewhere in the root; invalidate the whole snapshot. */
  invalidate() {
    ++this.#epoch;
    this.#artifacts = void 0;
    this.#projects = void 0;
    this.#summaries.clear();
    this.#details.clear();
    this.#pending.clear();
  }
  /**
   * Ignore unrelated filesystem churn; discovery changes still invalidate the candidate list.
   * @param {string} file Changed absolute file path.
   * @returns {boolean} Whether this file can invalidate known source facts or map discovery.
   */
  tracks(file) {
    return this.#trackedFiles.has(path.resolve(file)) || file.endsWith(".debug.json");
  }
  /** Worker responses publish dependency paths so the UI watcher can invalidate without reading maps. */
  trackedFiles() {
    return [...this.#trackedFiles];
  }
  /** Advances only when a complete current discovery snapshot replaces the watched dependency set. */
  trackedRevision() {
    return this.#trackedRevision;
  }
  /**
   * Coalesce identical work while allowing newer generations to replace invalidated requests.
   * @param {string} key Complete artifact/project, range, and request identity.
   * @param {Function} operation Deferred host request.
   * @returns {Promise<T>} Shared result; rejection removes the in-flight entry for retry.
   */
  async #request(key, operation) {
    const existing = this.#pending.get(key);
    if (existing) {
      return existing;
    }
    const pending2 = operation();
    this.#pending.set(key, pending2);
    try {
      return await pending2;
    } finally {
      if (this.#pending.get(key) === pending2) {
        this.#pending.delete(key);
      }
    }
  }
  async #loadArtifacts(dirtyFiles) {
    const epoch = this.#epoch;
    const tracked = /* @__PURE__ */ new Set();
    const discovered = await this.host.discoverMaps();
    const candidates = new Map(
      discovered.map((entry) => [path.resolve(entry.file), entry.sourceRoots])
    );
    for (const [file, roots] of this.#extraMaps) {
      candidates.set(file, roots);
    }
    const artifacts = [];
    const rejected = [];
    const seen = /* @__PURE__ */ new Set();
    for (const [file, roots] of candidates) {
      if (epoch !== this.#epoch) {
        return { artifacts: [], rejected: [] };
      }
      const sourceFiles = /* @__PURE__ */ new Set();
      const reasons = [];
      const reject = (reason) => {
        reasons.push(reason);
      };
      if (this.#currentConfigurationMaps && !this.#currentConfigurationMaps.has(file)) {
        rejected.push({
          file,
          sources: sourceFiles,
          reasons: ["Build settings changed. Run Build Binary to refresh this map."]
        });
        continue;
      }
      try {
        tracked.add(file);
        if ((await (0, import_promises.stat)(file)).size > 64 * 1024 * 1024) {
          reject("Debug map exceeds the 64 MiB inspection budget.");
          continue;
        }
        const map = JSON.parse(await (0, import_promises.readFile)(file, "utf8"));
        const errors = validateDebugMap(map);
        if (errors.length) {
          reject(`Invalid debug map: ${errors.join("; ")}`);
          continue;
        }
        const resolutionRoots = [.../* @__PURE__ */ new Set([path.dirname(file), ...roots])].sort(
          (a, b) => Number(file.startsWith(path.resolve(b) + path.sep)) - Number(file.startsWith(path.resolve(a) + path.sep)) || b.length - a.length
        );
        const sources = /* @__PURE__ */ new Map();
        for (const source of map.sources) {
          if (epoch !== this.#epoch) {
            return { artifacts: [], rejected: [] };
          }
          const paths = path.isAbsolute(source.path) ? [source.path] : resolutionRoots.map((root) => path.resolve(root, source.path));
          for (const candidate of paths) {
            sourceFiles.add(candidate);
            tracked.add(candidate);
          }
        }
        let current = true;
        for (const source of map.sources) {
          if (epoch !== this.#epoch) {
            return { artifacts: [], rejected: [] };
          }
          const paths = path.isAbsolute(source.path) ? [source.path] : [...new Set(resolutionRoots.map((root) => path.resolve(root, source.path)))];
          let resolved;
          let failure = `Source missing or unreadable: ${source.path}. Searched: ${paths.join(", ")}.`;
          for (const candidate of paths) {
            tracked.add(candidate);
            try {
              const metadata = await (0, import_promises.stat)(candidate);
              if (!metadata.isFile()) {
                continue;
              }
              if (dirtyFiles.has(candidate)) {
                failure = `Unsaved dependency: ${candidate}. Save it and run Build Binary.`;
                break;
              }
              if (metadata.size !== source.size) {
                failure = `Source differs from build: ${candidate} (${metadata.size} bytes; expected ${source.size}). Run Build Binary after saving source.`;
                break;
              }
              const actualHash = hash(await (0, import_promises.readFile)(candidate));
              if (actualHash === source.sha256) {
                resolved = candidate;
                break;
              }
              failure = `Source differs from build: ${candidate} (SHA-256 ${actualHash}; expected ${source.sha256}). Run Build Binary after saving source.`;
              break;
            } catch {
            }
          }
          if (!resolved) {
            current = false;
            reject(failure);
            continue;
          }
          sources.set(source.id, resolved);
        }
        if (!current) {
          continue;
        }
        const sourceIdentity = `${map.fingerprint.value}:${JSON.stringify([...sources])}`;
        if (seen.has(sourceIdentity)) {
          continue;
        }
        let output;
        const outputFile = file.replace(/\.debug\.json$/, "");
        if (outputFile !== file) {
          tracked.add(outputFile);
          try {
            const bytes = await (0, import_promises.readFile)(outputFile);
            if (bytes.length === map.output.size && hash(bytes) === map.output.sha256) {
              output = bytes;
            } else {
              reject(
                `Output differs from build map: ${outputFile}. Run Build Binary to publish a matching output and map.`
              );
              continue;
            }
          } catch {
          }
        }
        const lines = /* @__PURE__ */ new Map();
        for (const range of map.ranges) {
          const source = sources.get(range.sourceId);
          if (!source) {
            continue;
          }
          let byLine = lines.get(source);
          if (!byLine) {
            byLine = /* @__PURE__ */ new Map();
            lines.set(source, byLine);
          }
          let entries = byLine.get(range.line);
          if (!entries) {
            entries = [];
            byLine.set(range.line, entries);
          }
          entries.push(range);
        }
        const instructions = /* @__PURE__ */ new Map();
        for (const instruction of map.instructions ?? []) {
          const key = `${instruction.sourceId}:${instruction.line}`;
          const entries = instructions.get(key) ?? [];
          entries.push(instruction);
          instructions.set(key, entries);
        }
        artifacts.push({ file, map, output, sources, lines, instructions });
        seen.add(sourceIdentity);
      } catch (error) {
        reject(`Cannot load build map: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (reasons.length) {
          rejected.push({ file, sources: sourceFiles, reasons });
        }
      }
    }
    if (epoch !== this.#epoch) {
      return { artifacts: [], rejected: [] };
    }
    this.#trackedFiles.clear();
    for (const file of tracked) {
      this.#trackedFiles.add(file);
    }
    this.#trackedRevision++;
    return { artifacts, rejected };
  }
  /**
   * Explain snapshot rejection for one editor, including failures in another build dependency.
   * Reuses asynchronous validation; it never builds or changes source files.
   * @param {string} file Absolute source filename.
   * @param {ReadonlySet<string>} dirtyFiles Current unsaved dependencies.
   * @returns {Promise<readonly string[]>} Actionable reasons, or an empty list for a current map.
   */
  async diagnostics(file, dirtyFiles) {
    if (this.#currentConfigurationMaps?.size === 0) {
      return ["Build settings changed. Run Build Binary to refresh inline source information."];
    }
    const snapshot = await (this.#artifacts ??= this.#loadArtifacts(dirtyFiles));
    const source = path.resolve(file);
    const matching = snapshot.artifacts.filter(
      (artifact) => [...artifact.sources.values()].includes(source)
    );
    const dirty = matching.flatMap(
      (artifact) => [...artifact.sources.values()].filter((name) => dirtyFiles.has(name))
    );
    if (dirty.length) {
      return [...new Set(dirty)].map(
        (name) => `Unsaved dependency: ${name}. Save it and run Build Binary.`
      );
    }
    if (matching.length) {
      if (matching.every((artifact) => !artifact.output)) {
        const projects = await (this.#projects ??= this.host.projects());
        const validated = matching.some(
          (artifact) => projects.some(
            ({ manifest }) => manifest.target === artifact.map.target && manifest.rom.contentSha256 === artifact.map.output.sha256 && manifest.rom.contentSize === artifact.map.output.size
          )
        );
        if (!validated) {
          return [
            "Build output is missing and no analysis project matches the map's ROM identity. Run Build Binary."
          ];
        }
      }
      return [];
    }
    const relevant = snapshot.rejected.filter((entry) => entry.sources.has(source));
    const rejected = relevant.length ? relevant : snapshot.rejected;
    return [
      "No current build map covers this file. Run Build Binary; a changed dependency suppresses information for the entire build.",
      ...rejected.flatMap((entry) => entry.reasons.map((reason) => `${entry.file}: ${reason}`))
    ];
  }
  /**
   * Query current visible/hovered lines. Dirty dependencies suppress the complete artifact, even
   * if its saved files still hash correctly. Neither hovering nor scrolling starts a build.
   * @param {string} file Absolute source filename.
   * @param {readonly InformationLineRange[]} visible Inclusive one-based source-line intervals.
   * @param {InformationRequirements} requirements Selected fields' provider needs.
   * @param {ReadonlySet<string>} dirtyFiles Unsaved source/dependency paths to suppress.
   * @returns {Promise<ReadonlyMap<number, readonly LineInformation[]>>} Current facts grouped by source line.
   */
  async lines(file, visible, requirements, dirtyFiles) {
    if (this.#currentConfigurationMaps?.size === 0) {
      return /* @__PURE__ */ new Map();
    }
    const epoch = this.#epoch;
    const { artifacts } = await (this.#artifacts ??= this.#loadArtifacts(dirtyFiles));
    const result = /* @__PURE__ */ new Map();
    if (epoch !== this.#epoch) {
      return result;
    }
    let projects = [];
    if (requirements.counts || requirements.state || artifacts.some((artifact) => !artifact.output)) {
      projects = await (this.#projects ??= this.host.projects());
    }
    if (epoch !== this.#epoch) {
      return result;
    }
    for (const artifact of artifacts) {
      if ([...artifact.sources.values()].some((source) => dirtyFiles.has(source))) {
        continue;
      }
      const byLine = artifact.lines.get(path.resolve(file));
      if (!byLine) {
        continue;
      }
      const ranges = [...byLine].filter(([line]) => visible.some((range) => line >= range.start && line <= range.end)).flatMap(([, entries]) => entries).slice(0, 2e3);
      if (!ranges.length) {
        continue;
      }
      const matching = projects.filter(
        ({ manifest }) => manifest.target === artifact.map.target && manifest.rom.contentSha256 === artifact.map.output.sha256 && manifest.rom.contentSize === artifact.map.output.size
      );
      if (!artifact.output && !matching.length) {
        continue;
      }
      const contexts = matching.length ? matching : [void 0];
      for (const project of contexts) {
        const identity = `${project?.directory ?? "build"}:${artifact.file}:${artifact.map.fingerprint.value}`;
        const summaryKey = (range) => `${identity}:${rangeKey(range)}`;
        if (project && requirements.counts) {
          const missing = ranges.filter((range) => !this.#summaries.has(summaryKey(range)));
          if (missing.length) {
            const rows = await this.#request(
              `${identity}:counts:${JSON.stringify(missing)}`,
              () => this.host.request(
                project.directory,
                "annotationSummary",
                { ranges: missing }
              )
            );
            if (epoch !== this.#epoch) {
              return /* @__PURE__ */ new Map();
            }
            for (const row of rows) {
              if (missing[row.rangeIndex]) {
                this.#summaries.set(summaryKey(missing[row.rangeIndex]), row);
              }
            }
          }
        }
        if (project && requirements.state) {
          const missing = ranges.filter((range) => !this.#details.has(summaryKey(range)));
          if (missing.length) {
            const rows = await this.#request(
              `${identity}:details:${JSON.stringify(missing)}`,
              () => this.host.request(project.directory, "annotations", { ranges: missing })
            );
            if (epoch !== this.#epoch) {
              return /* @__PURE__ */ new Map();
            }
            for (const range of missing) {
              this.#details.set(
                summaryKey(range),
                rows.filter((row) => row.line === range.line).map((row) => row.annotation)
              );
            }
          }
        }
        const lines = new Set(ranges.map((range) => range.line));
        for (const line of lines) {
          const entries = [
            ...new Map(
              ranges.filter((range) => range.line === line).map((range) => [rangeKey(range), range])
            ).values()
          ];
          const locations = /* @__PURE__ */ new Map();
          const fileSpaces = project?.manifest.addressSpaces.filter((space) => space.kind === "file").map((space) => space.id) ?? ["output.file"];
          let limited = false;
          const annotations = /* @__PURE__ */ new Map();
          const spans = /* @__PURE__ */ new Map();
          for (const range of entries) {
            if (range.outputStart !== void 0 && range.outputEnd !== void 0) {
              spans.set(`${range.outputStart}:${range.outputEnd}`, {
                start: range.outputStart,
                end: range.outputEnd
              });
              for (const addressSpace of fileSpaces) {
                locations.set(`${addressSpace}:${range.outputStart}`, {
                  addressSpace,
                  address: range.outputStart,
                  file: true
                });
              }
            }
            locations.set(`${range.addressSpace}:${range.start}`, {
              addressSpace: range.addressSpace,
              address: range.start,
              file: fileSpaces.includes(range.addressSpace)
            });
          }
          for (const range of entries) {
            const summary = requirements.counts ? this.#summaries.get(summaryKey(range)) : void 0;
            limited ||= summary?.limited ?? false;
            for (const location of summary?.locations ?? []) {
              locations.set(`${location.addressSpace}:${location.address}`, {
                addressSpace: location.addressSpace,
                address: location.address,
                file: fileSpaces.includes(location.addressSpace),
                executionCount: location.executionCount
              });
            }
            if (requirements.state) {
              for (const annotation of this.#details.get(summaryKey(range)) ?? []) {
                annotations.set(annotation.id, annotation);
                limited ||= annotation.detailsLimited ?? false;
              }
            }
          }
          let outputSize = 0;
          const bytes = [];
          for (const span of spans.values()) {
            outputSize += span.end - span.start;
            if (requirements.bytes && artifact.output && bytes.length < 8) {
              for (let index = span.start; index < Math.min(span.end, artifact.output.length) && bytes.length < 8; index++) {
                bytes.push(artifact.output[index]);
              }
            }
          }
          const instructions = entries.flatMap(
            (range) => artifact.instructions.get(`${range.sourceId}:${line}`) ?? []
          );
          const info = {
            identity,
            label: project?.directory ?? artifact.file.replace(/\.debug\.json$/, ""),
            ranges: entries,
            locations: [...locations.values()],
            instructions: [...new Set(instructions)],
            ...requirements.bytes && artifact.output ? { bytes } : {},
            ...spans.size ? { outputSize } : {},
            ...requirements.state ? { annotations: [...annotations.values()] } : {},
            limited
          };
          const values = result.get(line) ?? [];
          values.push(info);
          result.set(line, values);
        }
      }
    }
    if (this.#summaries.size > 8192) {
      this.#summaries.clear();
    }
    if (this.#details.size > 2048) {
      this.#details.clear();
    }
    return result;
  }
};

// src/editor-info/worker.ts
if (!import_node_worker_threads.parentPort) {
  throw new Error("Source information worker needs its host message port.");
}
var port = import_node_worker_threads.parentPort;
var sequence = 0;
var pending = /* @__PURE__ */ new Map();
function host(method, args = []) {
  const id = ++sequence;
  return new Promise((resolve2, reject) => {
    pending.set(id, { resolve: (value) => resolve2(value), reject });
    port.postMessage({ type: "host", id, method, args });
  });
}
var provider = new EditorInformationProvider({
  discoverMaps: () => host("discoverMaps"),
  projects: () => host("projects"),
  request: (...args) => host("request", args)
});
var publishedRevision = -1;
var handleMessage = async (message) => {
  if (message.type === "hostResult") {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      request?.reject(new Error(message.error));
    } else {
      request?.resolve(message.value);
    }
    return;
  }
  try {
    let value;
    switch (message.method) {
      case "invalidate":
        provider.invalidate();
        break;
      case "configurationChanged":
        provider.configurationChanged();
        break;
      case "buildCompleted":
        provider.buildCompleted(
          ...message.args
        );
        break;
      case "diagnostics":
        value = await provider.diagnostics(
          ...message.args
        );
        break;
      case "lines":
        value = await provider.lines(
          ...message.args
        );
        break;
      default:
        throw new Error("Unknown source information operation.");
    }
    if (message.type === "query") {
      let tracked;
      if (publishedRevision !== provider.trackedRevision()) {
        publishedRevision = provider.trackedRevision();
        tracked = provider.trackedFiles();
      }
      port.postMessage({ type: "result", id: message.id, value, tracked });
    }
  } catch (error) {
    if (message.type === "query") {
      port.postMessage({ type: "result", id: message.id, error: String(error) });
    } else {
      port.postMessage({ type: "failure", error: String(error) });
    }
  }
};
port.on("message", (message) => {
  void handleMessage(message);
});

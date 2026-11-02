import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";

import {
  DEBUG_MAP_FORMAT,
  DEBUG_MAP_SCHEMA_VERSION,
  validateDebugMap,
  type DebugMap,
  type DebugMapRange,
  type DebugMapInstruction,
} from "@uttori/asm-core/debug-map";
import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";
import type { InstructionExecutionSummaryRow } from "@uttori/asm-disassembler/storage";

import type { EditorLocation, InformationRequirements, LineInformation } from "./format.js";

/** Fields the information provider reads from an analysis manifest. */
export interface EditorProjectManifest {
  /** Analysis target id bound to the manifest. */
  readonly target: string;
  /** ROM identity fields used to match debug maps and annotations. */
  readonly rom: { readonly contentSha256: string; readonly contentSize: number };
  /** Address spaces declared for the active analysis project. */
  readonly addressSpaces: readonly { readonly id: string; readonly kind: string }[];
}

/** Discovery is supplied by the host, keeping filesystem/provider behavior independently testable. */
export interface EditorInformationHost {
  /** Locate debug maps and the source roots that can resolve their portable paths. */
  discoverMaps(): Promise<readonly { file: string; sourceRoots: readonly string[] }[]>;
  /** List analysis projects whose manifests supply annotation queries. */
  projects(): Promise<readonly { directory: string; manifest: EditorProjectManifest }[]>;
  /** Forward annotation queries to the analysis worker for one project directory. */
  request(
    directory: string,
    operation: "annotationSummary" | "annotations",
    options: { ranges: readonly DebugMapRange[] },
  ): Promise<unknown>;
}

/** Narrow JSON payloads to plain objects before map validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored map must be inspectable by validateDebugMap; format and fingerprint stay its job. */
function isStoredDebugMap(value: unknown): value is Parameters<typeof validateDebugMap>[0] {
  return (
    isRecord(value) &&
    isRecord(value.fingerprint) &&
    typeof value.fingerprint.algorithm === "string" &&
    typeof value.fingerprint.value === "string" &&
    isRecord(value.output) &&
    typeof value.output.size === "number" &&
    typeof value.output.sha256 === "string" &&
    typeof value.target === "string" &&
    Array.isArray(value.sources) &&
    Array.isArray(value.ranges) &&
    (value.instructions === undefined || Array.isArray(value.instructions)) &&
    (value.assets === undefined || Array.isArray(value.assets))
  );
}

/** validateDebugMap reports mismatches; this admits only a map whose identity fields are current. */
function isAcceptedDebugMap(map: Parameters<typeof validateDebugMap>[0]): map is DebugMap {
  return (
    map.format === DEBUG_MAP_FORMAT &&
    map.schemaVersion === DEBUG_MAP_SCHEMA_VERSION &&
    map.fingerprint.algorithm === "sha256"
  );
}

/** Validate execution summary rows returned from analysis storage queries. */
function isExecutionSummaryRow(value: unknown): value is InstructionExecutionSummaryRow {
  return (
    isRecord(value) &&
    typeof value.rangeIndex === "number" &&
    typeof value.limited === "boolean" &&
    Array.isArray(value.locations) &&
    value.locations.every(
      (location) =>
        isRecord(location) &&
        typeof location.addressSpace === "string" &&
        typeof location.address === "number" &&
        typeof location.executionCount === "number" &&
        Array.isArray(location.outputOffsets) &&
        location.outputOffsets.every((offset) => typeof offset === "number"),
    )
  );
}

/** Validate one annotation row keyed by source line number. */
function isAnnotationRow(
  value: unknown,
): value is { readonly line: number; readonly annotation: InstructionAnalysisAnnotation } {
  return (
    isRecord(value) &&
    typeof value.line === "number" &&
    isRecord(value.annotation) &&
    typeof value.annotation.id === "string" &&
    (value.annotation.detailsLimited === undefined ||
      typeof value.annotation.detailsLimited === "boolean")
  );
}

/** UI-facing queries expose only visible facts; implementations may keep full maps in a worker. */
export type EditorInformationService = Pick<
  EditorInformationProvider,
  "buildCompleted" | "configurationChanged" | "invalidate" | "tracks" | "diagnostics" | "lines"
> & { dispose?(): void };

/** One accepted debug map and its derived indexes for a configuration generation. */
interface Artifact {
  readonly file: string;
  readonly map: DebugMap;
  readonly output?: Uint8Array;
  readonly sources: ReadonlyMap<number, string>;
  readonly lines: ReadonlyMap<string, ReadonlyMap<number, readonly DebugMapRange[]>>;
  readonly instructions: ReadonlyMap<string, readonly DebugMapInstruction[]>;
}

/** Rejection evidence belongs to the same immutable generation as the loaded artifacts. */
interface ArtifactSnapshot {
  readonly artifacts: readonly Artifact[];
  readonly rejected: readonly {
    file: string;
    /** Candidate source paths associate a failed dependency with every editor in that build. */
    sources: ReadonlySet<string>;
    reasons: readonly string[];
  }[];
}

/** One-based inclusive viewport ranges. */
export interface InformationLineRange {
  /** One-based inclusive first visible source line. */
  readonly start: number;
  /** One-based inclusive last visible source line. */
  readonly end: number;
}

/** Hash artifact bytes for identity comparisons across reloads. */
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
/** Stable cache key for a debug-map range record. */
const rangeKey = (range: DebugMapRange): string => JSON.stringify(range);

/**
 * Snapshot-backed source information, independent of analysis projects. All I/O is asynchronous;
 * indexes and bounded facts survive viewport/presentation changes, but never source invalidation.
 */
export class EditorInformationProvider {
  #artifacts?: Promise<ArtifactSnapshot>;
  #projects?: ReturnType<EditorInformationHost["projects"]>;
  #epoch = 0;
  /** After settings change, each artifact must be rebuilt before its old interpretation is usable. */
  #currentConfigurationMaps?: Set<string>;
  readonly #extraMaps = new Map<string, readonly string[]>();
  readonly #summaries = new Map<string, InstructionExecutionSummaryRow>();
  readonly #details = new Map<string, readonly InstructionAnalysisAnnotation[]>();
  readonly #pending = new Map<string, Promise<unknown>>();
  readonly #trackedFiles = new Set<string>();
  #trackedRevision = 0;

  constructor(readonly host: EditorInformationHost) {}

  /**
   * New successful build paths bypass workspace glob limits and invalidate old artifact facts.
   * @param mapFile Debug map published atomically with a successful output.
   * @param sourceRoot Root used to resolve portable source paths.
   */
  buildCompleted(mapFile: string, sourceRoot: string): void {
    const file = path.resolve(mapFile);
    // A source root has one selected build. Historical receipts stay on disk, not in the live UI index.
    for (const [previous, roots] of this.#extraMaps) {
      if (roots.includes(sourceRoot)) {
        this.#extraMaps.delete(previous);
        this.#currentConfigurationMaps?.delete(previous);
      }
    }
    this.#currentConfigurationMaps?.add(file);
    this.#extraMaps.set(file, [sourceRoot]);
    // Discovery covers open workspace roots. Keep only a bounded set of recent explicit build
    // hints so opening and closing many standalone projects cannot retain all historical paths.
    while (this.#extraMaps.size > 16) {
      const oldest = this.#extraMaps.keys().next().value!;
      this.#extraMaps.delete(oldest);
      this.#currentConfigurationMaps?.delete(oldest);
    }
    this.invalidate();
  }

  /** Hide artifacts produced under previous target/include/options settings until a successful build. */
  configurationChanged(): void {
    this.#currentConfigurationMaps = new Set();
    this.invalidate();
  }

  /** Any changed dependency can alter layout elsewhere in the root; invalidate the whole snapshot. */
  invalidate(): void {
    ++this.#epoch;
    this.#artifacts = undefined;
    this.#projects = undefined;
    this.#summaries.clear();
    this.#details.clear();
    this.#pending.clear();
  }

  /**
   * Ignore unrelated filesystem churn; discovery changes still invalidate the candidate list.
   * @param file Changed absolute file path.
   * @returns Whether this file can invalidate known source facts or map discovery.
   */
  tracks(file: string): boolean {
    return this.#trackedFiles.has(path.resolve(file)) || file.endsWith(".debug.json");
  }

  /** Worker responses publish dependency paths so the UI watcher can invalidate without reading maps. */
  trackedFiles(): readonly string[] {
    return [...this.#trackedFiles];
  }

  /** Advances only when a complete current discovery snapshot replaces the watched dependency set. */
  trackedRevision(): number {
    return this.#trackedRevision;
  }

  /**
   * Coalesce identical work while allowing newer generations to replace invalidated requests.
   * @param key Complete artifact/project, range, and request identity.
   * @param operation Deferred host request.
   * @returns Shared result; rejection removes the in-flight entry for retry.
   */
  async #request(key: string, operation: () => Promise<unknown>): Promise<unknown> {
    const existing = this.#pending.get(key);
    if (existing) {
      return existing;
    }
    const pending = operation();
    this.#pending.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.#pending.get(key) === pending) {
        this.#pending.delete(key);
      }
    }
  }

  async #loadArtifacts(dirtyFiles: ReadonlySet<string>): Promise<ArtifactSnapshot> {
    const epoch = this.#epoch;
    const tracked = new Set<string>();
    const discovered = await this.host.discoverMaps();
    const candidates = new Map(
      discovered.map((entry) => [path.resolve(entry.file), entry.sourceRoots]),
    );
    for (const [file, roots] of this.#extraMaps) {
      candidates.set(file, roots);
    }
    const artifacts: Artifact[] = [];
    const rejected: ArtifactSnapshot["rejected"][number][] = [];
    const seen = new Set<string>();
    // Bound concurrent reads: a project may contain thousands of dependency files.
    for (const [file, roots] of candidates) {
      if (epoch !== this.#epoch) {
        return { artifacts: [], rejected: [] };
      }
      const sourceFiles = new Set<string>();
      const reasons: string[] = [];
      const reject = (reason: string): void => {
        reasons.push(reason);
      };
      if (this.#currentConfigurationMaps && !this.#currentConfigurationMaps.has(file)) {
        rejected.push({
          file,
          sources: sourceFiles,
          reasons: ["Build settings changed. Run Build Binary to refresh this map."],
        });
        continue;
      }
      try {
        tracked.add(file);
        if ((await stat(file)).size > 64 * 1024 * 1024) {
          reject("Debug map exceeds the 64 MiB inspection budget.");
          continue;
        }
        const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
        if (!isStoredDebugMap(parsed)) {
          throw new Error(
            "Debug map is not an object with fingerprint, output, sources, and ranges.",
          );
        }
        const errors = validateDebugMap(parsed);
        if (errors.length || !isAcceptedDebugMap(parsed)) {
          reject(`Invalid debug map: ${errors.join("; ")}`);
          continue;
        }
        const map = parsed;
        // Prefer the map's own ancestors before other workspace roots. Identical relative paths
        // in two workspace folders must not attach one project's addresses to the other file.
        const resolutionRoots = [...new Set([path.dirname(file), ...roots])].toSorted(
          (a, b) =>
            Number(file.startsWith(path.resolve(b) + path.sep)) -
              Number(file.startsWith(path.resolve(a) + path.sep)) || b.length - a.length,
        );
        const sources = new Map<number, string>();
        // Record every dependency before validation: a failure early in the source list must
        // still explain why other source editors in this build have no annotations.
        for (const source of map.sources) {
          if (epoch !== this.#epoch) {
            return { artifacts: [], rejected: [] };
          }
          const paths = path.isAbsolute(source.path)
            ? [source.path]
            : resolutionRoots.map((root) => path.resolve(root, source.path));
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
          const paths = path.isAbsolute(source.path)
            ? [source.path]
            : [...new Set(resolutionRoots.map((root) => path.resolve(root, source.path)))];
          let resolved: string | undefined;
          let failure = `Source missing or unreadable: ${source.path}. Searched: ${paths.join(", ")}.`;
          for (const candidate of paths) {
            tracked.add(candidate);
            try {
              const metadata = await stat(candidate);
              if (!metadata.isFile()) {
                continue;
              }
              // The first existing path belongs to this map's root. A stale or dirty source must
              // not fall through to a same-named file with matching bytes in another workspace.
              if (dirtyFiles.has(candidate)) {
                failure = `Unsaved dependency: ${candidate}. Save it and run Build Binary.`;
                break;
              }
              if (metadata.size !== source.size) {
                failure = `Source differs from build: ${candidate} (${metadata.size} bytes; expected ${source.size}). Run Build Binary after saving source.`;
                break;
              }
              const actualHash = hash(await readFile(candidate));
              if (actualHash === source.sha256) {
                resolved = candidate;
                break;
              }
              failure = `Source differs from build: ${candidate} (SHA-256 ${actualHash}; expected ${source.sha256}). Run Build Binary after saving source.`;
              break;
            } catch {
              /* Missing candidates may resolve against another recorded root. */
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
        let output: Uint8Array | undefined;
        const outputFile = file.replace(/\.debug\.json$/, "");
        if (outputFile !== file) {
          tracked.add(outputFile);
          try {
            const bytes = await readFile(outputFile);
            if (bytes.length === map.output.size && hash(bytes) === map.output.sha256) {
              output = bytes;
            } else {
              reject(
                `Output differs from build map: ${outputFile}. Run Build Binary to publish a matching output and map.`,
              );
              continue;
            }
          } catch {
            /* An analysis project may still validate this map's ROM identity below. */
          }
        }
        const lines = new Map<string, Map<number, DebugMapRange[]>>();
        for (const range of map.ranges) {
          const source = sources.get(range.sourceId);
          if (!source) {
            continue;
          }
          let byLine = lines.get(source);
          if (!byLine) {
            byLine = new Map();
            lines.set(source, byLine);
          }
          let entries = byLine.get(range.line);
          if (!entries) {
            entries = [];
            byLine.set(range.line, entries);
          }
          entries.push(range);
        }
        const instructions = new Map<string, DebugMapInstruction[]>();
        for (const instruction of map.instructions ?? []) {
          const key = `${instruction.sourceId}:${instruction.line}`;
          const entries = instructions.get(key) ?? [];
          entries.push(instruction);
          instructions.set(key, entries);
        }
        artifacts.push({ file, map, output, sources, lines, instructions });
        seen.add(sourceIdentity);
      } catch (error) {
        /* Malformed or partially published maps are retried after filesystem invalidation. */
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
   * @param file Absolute source filename.
   * @param dirtyFiles Current unsaved dependencies.
   * @returns Actionable reasons, or an empty list for a current map.
   */
  async diagnostics(file: string, dirtyFiles: ReadonlySet<string>): Promise<readonly string[]> {
    if (this.#currentConfigurationMaps?.size === 0) {
      return ["Build settings changed. Run Build Binary to refresh inline source information."];
    }
    const snapshot = await (this.#artifacts ??= this.#loadArtifacts(dirtyFiles));
    const source = path.resolve(file);
    const matching = snapshot.artifacts.filter((artifact) =>
      [...artifact.sources.values()].includes(source),
    );
    const dirty = matching.flatMap((artifact) =>
      [...artifact.sources.values()].filter((name) => dirtyFiles.has(name)),
    );
    if (dirty.length) {
      return [...new Set(dirty)].map(
        (name) => `Unsaved dependency: ${name}. Save it and run Build Binary.`,
      );
    }
    if (matching.length) {
      if (matching.every((artifact) => !artifact.output)) {
        const projects = await (this.#projects ??= this.host.projects());
        const validated = matching.some((artifact) =>
          projects.some(
            ({ manifest }) =>
              manifest.target === artifact.map.target &&
              manifest.rom.contentSha256 === artifact.map.output.sha256 &&
              manifest.rom.contentSize === artifact.map.output.size,
          ),
        );
        if (!validated) {
          return [
            "Build output is missing and no analysis project matches the map's ROM identity. Run Build Binary.",
          ];
        }
      }
      return [];
    }
    const relevant = snapshot.rejected.filter((entry) => entry.sources.has(source));
    const rejected = relevant.length ? relevant : snapshot.rejected;
    return [
      "No current build map covers this file. Run Build Binary; a changed dependency suppresses information for the entire build.",
      ...rejected.flatMap((entry) => entry.reasons.map((reason) => `${entry.file}: ${reason}`)),
    ];
  }

  /**
   * Query current visible/hovered lines. Dirty dependencies suppress the complete artifact, even
   * if its saved files still hash correctly. Neither hovering nor scrolling starts a build.
   * @param file Absolute source filename.
   * @param visible Inclusive one-based source-line intervals.
   * @param requirements Selected fields' provider needs.
   * @param dirtyFiles Unsaved source/dependency paths to suppress.
   * @returns Current facts grouped by source line.
   */
  async lines(
    file: string,
    visible: readonly InformationLineRange[],
    requirements: InformationRequirements,
    dirtyFiles: ReadonlySet<string>,
  ): Promise<ReadonlyMap<number, readonly LineInformation[]>> {
    if (this.#currentConfigurationMaps?.size === 0) {
      return new Map();
    }
    const epoch = this.#epoch;
    const { artifacts } = await (this.#artifacts ??= this.#loadArtifacts(dirtyFiles));
    const result = new Map<number, LineInformation[]>();
    if (epoch !== this.#epoch) {
      return result;
    }
    let projects: Awaited<ReturnType<EditorInformationHost["projects"]>> = [];
    if (
      requirements.counts ||
      requirements.state ||
      artifacts.some((artifact) => !artifact.output)
    ) {
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
      const ranges = [...byLine]
        .filter(([line]) => visible.some((range) => line >= range.start && line <= range.end))
        .flatMap(([, entries]) => entries)
        .slice(0, 2000);
      if (!ranges.length) {
        continue;
      }
      const matching = projects.filter(
        ({ manifest }) =>
          manifest.target === artifact.map.target &&
          manifest.rom.contentSha256 === artifact.map.output.sha256 &&
          manifest.rom.contentSize === artifact.map.output.size,
      );
      if (!artifact.output && !matching.length) {
        continue;
      }
      const contexts = matching.length ? matching : [undefined];
      for (const project of contexts) {
        const identity = `${project?.directory ?? "build"}:${artifact.file}:${artifact.map.fingerprint.value}`;
        const summaryKey = (range: DebugMapRange): string => `${identity}:${rangeKey(range)}`;
        if (project && requirements.counts) {
          const missing = ranges.filter((range) => !this.#summaries.has(summaryKey(range)));
          if (missing.length) {
            const rows = await this.#request(`${identity}:counts:${JSON.stringify(missing)}`, () =>
              this.host.request(project.directory, "annotationSummary", { ranges: missing }),
            );
            if (!Array.isArray(rows) || !rows.every(isExecutionSummaryRow)) {
              throw new Error("Analysis execution summary is unavailable.");
            }
            if (epoch !== this.#epoch) {
              return new Map();
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
            const rows = await this.#request(`${identity}:details:${JSON.stringify(missing)}`, () =>
              this.host.request(project.directory, "annotations", { ranges: missing }),
            );
            if (!Array.isArray(rows) || !rows.every(isAnnotationRow)) {
              throw new Error("Analysis annotations are unavailable.");
            }
            if (epoch !== this.#epoch) {
              return new Map();
            }
            for (const range of missing) {
              this.#details.set(
                summaryKey(range),
                rows.filter((row) => row.line === range.line).map((row) => row.annotation),
              );
            }
          }
        }
        const lines = new Set(ranges.map((range) => range.line));
        for (const line of lines) {
          const entries = [
            ...new Map(
              ranges
                .filter((range) => range.line === line)
                .map((range) => [rangeKey(range), range]),
            ).values(),
          ];
          const locations = new Map<string, EditorLocation>();
          const fileSpaces = project?.manifest.addressSpaces
            .filter((space) => space.kind === "file")
            .map((space) => space.id) ?? ["output.file"];
          let limited = false;
          const annotations = new Map<string, InstructionAnalysisAnnotation>();
          const spans = new Map<string, { start: number; end: number }>();
          for (const range of entries) {
            if (range.outputStart !== undefined && range.outputEnd !== undefined) {
              spans.set(`${range.outputStart}:${range.outputEnd}`, {
                start: range.outputStart,
                end: range.outputEnd,
              });
              for (const addressSpace of fileSpaces) {
                locations.set(`${addressSpace}:${range.outputStart}`, {
                  addressSpace,
                  address: range.outputStart,
                  file: true,
                });
              }
            }
            locations.set(`${range.addressSpace}:${range.start}`, {
              addressSpace: range.addressSpace,
              address: range.start,
              file: fileSpaces.includes(range.addressSpace),
            });
          }
          for (const range of entries) {
            const summary = requirements.counts
              ? this.#summaries.get(summaryKey(range))
              : undefined;
            limited ||= summary?.limited ?? false;
            for (const location of summary?.locations ?? []) {
              locations.set(`${location.addressSpace}:${location.address}`, {
                addressSpace: location.addressSpace,
                address: location.address,
                file: fileSpaces.includes(location.addressSpace),
                executionCount: location.executionCount,
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
          const bytes: number[] = [];
          for (const span of spans.values()) {
            outputSize += span.end - span.start;
            if (requirements.bytes && artifact.output && bytes.length < 8) {
              for (
                let index = span.start;
                index < Math.min(span.end, artifact.output.length) && bytes.length < 8;
                index++
              ) {
                bytes.push(artifact.output[index]);
              }
            }
          }
          const instructions = entries.flatMap(
            (range) => artifact.instructions.get(`${range.sourceId}:${line}`) ?? [],
          );
          // Each map instruction object appears once even when one line owns several output spans.
          const info: LineInformation = {
            identity,
            label: project?.directory ?? artifact.file.replace(/\.debug\.json$/, ""),
            ranges: entries,
            locations: [...locations.values()],
            instructions: [...new Set(instructions)],
            ...(requirements.bytes && artifact.output ? { bytes } : {}),
            ...(spans.size ? { outputSize } : {}),
            ...(requirements.state ? { annotations: [...annotations.values()] } : {}),
            limited,
          };
          const values = result.get(line) ?? [];
          values.push(info);
          result.set(line, values);
        }
      }
    }
    // Viewports normally need tens of entries. Bound retained facts during long navigation sessions.
    if (this.#summaries.size > 8192) {
      this.#summaries.clear();
    }
    if (this.#details.size > 2048) {
      this.#details.clear();
    }
    return result;
  }
}

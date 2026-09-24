import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";

import {
  validateDebugMap,
  type DebugMap,
  type DebugMapRange,
  type DebugMapInstruction,
} from "@uttori/asm-core/debug-map";
import type {
  AnalysisProjectManifest,
  InstructionAnalysisAnnotation,
  InstructionExecutionSummaryRow,
} from "@uttori/asm-disassembler";

import type { EditorLocation, InformationRequirements, LineInformation } from "./format.js";

/** Discovery is supplied by the host, keeping filesystem/provider behavior independently testable. */
export interface EditorInformationHost {
  discoverMaps(): Promise<readonly { file: string; sourceRoots: readonly string[] }[]>;
  projects(): Promise<readonly { directory: string; manifest: AnalysisProjectManifest }[]>;
  request<T>(
    directory: string,
    operation: "annotationSummary" | "annotations",
    options: { ranges: readonly DebugMapRange[] },
  ): Promise<T>;
}

interface Artifact {
  readonly file: string;
  readonly map: DebugMap;
  readonly output?: Uint8Array;
  readonly sources: ReadonlyMap<number, string>;
  readonly lines: ReadonlyMap<string, ReadonlyMap<number, readonly DebugMapRange[]>>;
  readonly instructions: ReadonlyMap<string, readonly DebugMapInstruction[]>;
}

/** One-based inclusive viewport ranges. */
export interface InformationLineRange {
  readonly start: number;
  readonly end: number;
}

const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const rangeKey = (range: DebugMapRange): string => JSON.stringify(range);

/**
 * Snapshot-backed source information, independent of analysis projects. All I/O is asynchronous;
 * indexes and bounded facts survive viewport/presentation changes, but never source invalidation.
 */
export class EditorInformationProvider {
  #artifacts?: Promise<readonly Artifact[]>;
  #projects?: ReturnType<EditorInformationHost["projects"]>;
  #epoch = 0;
  /** After settings change, each artifact must be rebuilt before its old interpretation is usable. */
  #currentConfigurationMaps?: Set<string>;
  readonly #extraMaps = new Map<string, readonly string[]>();
  readonly #summaries = new Map<string, InstructionExecutionSummaryRow>();
  readonly #details = new Map<string, readonly InstructionAnalysisAnnotation[]>();
  readonly #pending = new Map<string, Promise<unknown>>();
  readonly #trackedFiles = new Set<string>();

  constructor(readonly host: EditorInformationHost) {}

  /**
   * New successful build paths bypass workspace glob limits and invalidate old artifact facts.
   * @param {string} mapFile Debug map published atomically with a successful output.
   * @param {string} sourceRoot Root used to resolve portable source paths.
   */
  buildCompleted(mapFile: string, sourceRoot: string): void {
    const file = path.resolve(mapFile);
    this.#currentConfigurationMaps?.add(file);
    this.#extraMaps.set(file, [sourceRoot]);
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
   * @param {string} file Changed absolute file path.
   * @returns {boolean} Whether this file can invalidate known source facts or map discovery.
   */
  tracks(file: string): boolean {
    return this.#trackedFiles.has(path.resolve(file)) || file.endsWith(".debug.json");
  }

  /**
   * Coalesce identical work while allowing newer generations to replace invalidated requests.
   * @param {string} key Complete artifact/project, range, and request identity.
   * @param {Function} operation Deferred host request.
   * @returns {Promise<T>} Shared result; rejection removes the in-flight entry for retry.
   */
  async #request<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.#pending.get(key);
    if (existing) {
      return existing as Promise<T>;
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

  async #loadArtifacts(dirtyFiles: ReadonlySet<string>): Promise<readonly Artifact[]> {
    const discovered = await this.host.discoverMaps();
    const candidates = new Map(
      discovered.map((entry) => [path.resolve(entry.file), entry.sourceRoots]),
    );
    for (const [file, roots] of this.#extraMaps) {
      candidates.set(file, roots);
    }
    const artifacts: Artifact[] = [];
    const seen = new Set<string>();
    // Bound concurrent reads: a project may contain thousands of dependency files.
    for (const [file, roots] of candidates) {
      if (this.#currentConfigurationMaps && !this.#currentConfigurationMaps.has(file)) {
        continue;
      }
      try {
        this.#trackedFiles.add(file);
        const map = JSON.parse(await readFile(file, "utf8")) as DebugMap;
        if (validateDebugMap(map).length) {
          continue;
        }
        // Prefer the map's own ancestors before other workspace roots. Identical relative paths
        // in two workspace folders must not attach one project's addresses to the other file.
        const resolutionRoots = [...new Set([path.dirname(file), ...roots])].sort(
          (a, b) =>
            Number(file.startsWith(path.resolve(b) + path.sep)) -
              Number(file.startsWith(path.resolve(a) + path.sep)) || b.length - a.length,
        );
        const sources = new Map<number, string>();
        let current = true;
        for (const source of map.sources) {
          const paths = path.isAbsolute(source.path)
            ? [source.path]
            : [...new Set(resolutionRoots.map((root) => path.resolve(root, source.path)))];
          let resolved: string | undefined;
          for (const candidate of paths) {
            this.#trackedFiles.add(candidate);
            try {
              const metadata = await stat(candidate);
              if (!metadata.isFile()) {
                continue;
              }
              // The first existing path belongs to this map's root. A stale or dirty source must
              // not fall through to a same-named file with matching bytes in another workspace.
              if (dirtyFiles.has(candidate) || metadata.size !== source.size) {
                break;
              }
              if (hash(await readFile(candidate)) === source.sha256) {
                resolved = candidate;
                break;
              }
              break;
            } catch {
              /* Missing candidates may resolve against another recorded root. */
            }
          }
          if (!resolved) {
            current = false;
            break;
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
          this.#trackedFiles.add(outputFile);
          try {
            const bytes = await readFile(outputFile);
            if (bytes.length === map.output.size && hash(bytes) === map.output.sha256) {
              output = bytes;
            } else {
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
      } catch {
        /* Malformed or partially published maps are retried after filesystem invalidation. */
      }
    }
    return artifacts;
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
    const artifacts = await (this.#artifacts ??= this.#loadArtifacts(dirtyFiles));
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
              this.host.request<readonly InstructionExecutionSummaryRow[]>(
                project.directory,
                "annotationSummary",
                { ranges: missing },
              ),
            );
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
              this.host.request<
                readonly { line: number; annotation: InstructionAnalysisAnnotation }[]
              >(project.directory, "annotations", { ranges: missing }),
            );
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

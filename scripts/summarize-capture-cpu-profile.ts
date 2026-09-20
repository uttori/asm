import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { SourceMap, type SourceMapPayload } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** V8 sampling durations are microseconds. Inclusive samples overlap across
 * callers. Only exclusive samples partition the observed profile duration.
 */
interface ProfileNode {
  readonly id: number;
  readonly children?: readonly number[];
  readonly callFrame: {
    readonly functionName: string;
    readonly url: string;
    readonly lineNumber: number;
    readonly columnNumber: number;
  };
}
interface Profile {
  readonly nodes: readonly ProfileNode[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
}
const [input, output, mapFile] = process.argv.slice(2);
if (!input || !output)
  throw new Error("Usage: summarize-capture-cpu-profile.ts PROFILE OUTPUT [BUNDLE.map]");
const bytes = await readFile(input);
const profile = JSON.parse(bytes.toString("utf8")) as Profile;
assert.equal(profile.samples.length, profile.timeDeltas.length);
const mapBytes = mapFile ? await readFile(mapFile) : undefined;
const map = mapBytes
  ? new SourceMap(JSON.parse(mapBytes.toString("utf8")) as SourceMapPayload)
  : undefined;
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const parents = new Map<number, number>();
const identity = new Map<number, string>();
const locations = new Map<
  string,
  { functionName: string; file: string; line: number; column: number }
>();
for (const node of profile.nodes) {
  for (const child of node.children ?? []) parents.set(child, node.id);
  const frame = node.callFrame;
  let file = frame.url;
  let line = frame.lineNumber;
  let column = frame.columnNumber;
  let functionName = frame.functionName || "(anonymous)";
  // Apply the supplied map only to its matching bundle, never to Node internals
  // or another script with coincidentally identical generated coordinates.
  if (map && mapFile && file.endsWith(path.basename(mapFile, ".map"))) {
    const entry = map.findEntry(line, column);
    if ("originalSource" in entry) {
      file = path.resolve(path.dirname(mapFile), entry.originalSource);
      line = entry.originalLine;
      column = entry.originalColumn;
    }
  }
  if (file.startsWith("file:")) file = fileURLToPath(file);
  if (path.isAbsolute(file)) file = path.relative(process.cwd(), file);
  const key = `${file}:${line}:${column}:${functionName}`;
  identity.set(node.id, key);
  locations.set(key, { functionName, file, line: line + 1, column: column + 1 });
}
const exclusive = new Map<string, number>();
const inclusive = new Map<string, number>();
let totalUs = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i],
    us = profile.timeDeltas[i];
  assert(nodes.has(id) && Number.isFinite(us) && us >= 0);
  totalUs += us;
  const leaf = identity.get(id)!;
  exclusive.set(leaf, (exclusive.get(leaf) ?? 0) + us);
  const seen = new Set<string>();
  for (let cursor: number | undefined = id; cursor !== undefined; cursor = parents.get(cursor)) {
    const key = identity.get(cursor)!;
    if (seen.has(key)) continue;
    seen.add(key);
    inclusive.set(key, (inclusive.get(key) ?? 0) + us);
  }
}
const rows = (counts: Map<string, number>) =>
  [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([key, us]) => ({
      ...locations.get(key)!,
      sampledMs: us / 1000,
      percent: (us * 100) / totalUs,
    }));
await writeFile(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      profileSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceMapSha256: mapBytes ? createHash("sha256").update(mapBytes).digest("hex") : undefined,
      samples: profile.samples.length,
      sampledWallMs: totalUs / 1000,
      note: "Statistical samples include startup, GC and idle time. Inclusive rows overlap. Native work can be charged to its JS caller. No per-event timers or production changes.",
      exclusive: rows(exclusive),
      inclusive: rows(inclusive),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Summarized ${profile.samples.length} samples across ${exclusive.size} exclusive locations.`,
);

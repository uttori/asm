import { open, mkdir, writeFile, readFile, mkdtemp, link, rm } from "node:fs/promises";
import path from "node:path";

import { readCaptureFileHeader } from "@uttori/asm-capture";
import { DEFAULT_RUNTIME_TRACE_MAX_BYTES, type ResearchSnapshot } from "@uttori/asm-disassembler";

import { createNesGraphicsProjection, publishNesGraphicsEvidence } from "./ppu-evidence.js";
import { summarizeNesPPUCapture } from "./ppu.js";

/**
 * Import a complete PPU archive into a separate, immutable graphics report.
 * Returns null for other formats/scopes. Graphics observations never seed CPU disassembly.
 * Input deletion belongs to the caller. Reports and SQLite facts remain usable after removal;
 * the archive hash identifies the verified input without requiring its ordered stream to survive.
 */
export async function importNesPPUCapture(options: {
  readonly file: string;
  /** Optional authoritative SQLite store. Report-only callers retain the original behavior. */
  readonly evidenceDirectory?: string;
  readonly research?: ResearchSnapshot;
  readonly assertResearchCurrent?: () => void;
  readonly directory: string;
  readonly romFileSha256: string;
  readonly romContentSha256: string;
  readonly signal?: AbortSignal;
  /** Per-archive byte limit; defaults to the shared 32 GiB capture budget. */
  readonly maxBytes?: number;
}) {
  const handle = await open(options.file, "r");
  const magic = Buffer.alloc(4);
  try {
    await handle.read(magic, 0, 4, 0);
  } finally {
    await handle.close();
  }
  if (magic.toString("ascii") !== "ACS2") {
    return null;
  }
  const limits = { ...options, maxBytes: options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES };
  const header = await readCaptureFileHeader(options.file, limits);
  if (header.scope !== "nes.cpu-bus-ppu") {
    return null;
  }
  const projection = options.evidenceDirectory ? createNesGraphicsProjection() : undefined;
  const summary = await summarizeNesPPUCapture(options.file, {
    ...limits,
    onBusEvent: projection?.push,
  });
  const directory = path.resolve(options.directory);
  await mkdir(directory, { recursive: true });
  const report = path.join(directory, `${summary.archiveSha256}.json`);
  // Existing bus-only reports are immutable; retain their original v1 payload
  // when no new timeline records exist, so older archives remain idempotent.
  const { timeline, ...busSummary } = summary;
  const hasTimeline =
    timeline.fetches + timeline.a12Edges + timeline.mapperWrites + timeline.irqEdges > 0;
  const payload = hasTimeline ? { version: 2, ...summary } : { version: 1, ...busSummary };
  const bytes = JSON.stringify({ format: "uttori-nes-ppu-evidence", ...payload }, null, 2) + "\n";
  options.signal?.throwIfAborted();
  let changed = true;
  const staging = await mkdtemp(path.join(directory, ".pending-"));
  try {
    const temporary = path.join(staging, "report.json");
    await writeFile(temporary, bytes, { flag: "wx" });
    // Link publishes an immutable, already-complete file without replacing an existing report.
    try {
      await link(temporary, report);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST" ||
        (await readFile(report, "utf8")) !== bytes
      ) {
        throw error;
      }
      changed = false;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  const published =
    options.evidenceDirectory && projection
      ? publishNesGraphicsEvidence({
          ...options,
          directory: options.evidenceDirectory,
          summary,
          records: projection.finish(summary.archiveSha256),
        })
      : undefined;
  return {
    sourceSha256: summary.archiveSha256,
    changed: changed || (published?.changed ?? false),
    added: published?.added ?? { runtime: 0, evidence: changed ? 1 : 0 },
    droppedEvents: 0,
    warnings: [],
    report,
    observedEvents: summary.events,
  };
}

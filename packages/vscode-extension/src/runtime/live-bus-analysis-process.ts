import { setImmediate as yieldToMessages, setTimeout as delay } from "node:timers/promises";

import { NativeCaptureFileCursor, type NativeCaptureFilePosition } from "@uttori/asm-debug-adapter";
import {
  importRuntimeBusTraceSourceIntoProject,
  validateRuntimeBusTraceMetadata,
} from "@uttori/asm-disassembler";

/** readThrough can mark the cursor complete before the next backlog decision. */
function captureCursorComplete(cursor: NativeCaptureFileCursor): boolean {
  return cursor.complete;
}

/** One capture per process. Positions are coalesced. Event bytes stay in the archive.
 * SQLite temp staging survives asynchronous reads without locking the project.
 */
export interface LiveBusStart {
  readonly type: "start";
  readonly file: string;
  readonly projectDirectory: string;
  readonly position: NativeCaptureFilePosition;
  /** Maximum unread synced archive bytes. Exhaustion cancels analysis, never recording. */
  readonly maxLagBytes: number;
  /** Project import byte budget, including native framing and the terminal record. */
  readonly maxBytes: number;
  readonly maxIndexRecords: number;
  /** Opt-in coarse stage/scheduling timings. Omitted in normal editor sessions. */
  readonly profile?: boolean;
}

/** Wall-clock milliseconds and wait counts, collected only when profiling is enabled.
 * Stage spans include cursor work and scheduling. They are not additive budgets.
 */
export interface LiveBusProfile {
  /** Includes read/decode/index work and the cursor's internal checkpoint yields. */
  cursorMs: number;
  /** Outer worker yields only. Cursor checkpoint yields are already inside cursorMs. */
  yields: number;
  yieldMs: number;
  idleWaits: number;
  idleMs: number;
  stages: Record<string, number>;
}
/**
 * Abort controller for this child process’s single importer; cancellation discards provisional
 * analysis without stopping capture.
 */
const cancellation = new AbortController();
/**
 * Newest recorder checkpoint received from the parent; intermediate positions are replaced
 * because archive bytes remain on disk.
 */
let latest: NativeCaptureFilePosition | undefined;
/** One-way guard allowing at most one live-analysis start request per child process. */
let started = false;
/**
 * Whether a progress preview is awaiting parent acknowledgment; prevents UI stalls from growing
 * the IPC queue.
 */
let previewInFlight = false;
/**
 * Latest unsent progress preview, replacing older provisional snapshots while one message is in
 * flight.
 */
let pendingPreview: unknown;
/**
 * Flush the newest provisional status under the parent acknowledgment protocol without pausing
 * indexing.
 */
const flushPreview = (): void => {
  // Keep one preview in flight so UI stalls cannot grow the IPC queue; newer updates replace the pending preview.
  if (previewInFlight || !pendingPreview) {
    return;
  }
  previewInFlight = true;
  const message = pendingPreview;
  pendingPreview = undefined;
  process.send?.(message);
};

const settle = (value: unknown): void => {
  process.send?.(value, () => process.disconnect?.());
};

/**
 * Start at most one importer, coalesce acknowledged recorder positions, and handle
 * cancellation/preview acknowledgments.
 * Send the final result or error before disconnecting the child IPC channel.
 * @param {object} message Start, latest-position, cancellation, or preview-acknowledgment message from the parent.
 */
export const handleLiveBusProcessMessage = (
  message:
    | LiveBusStart
    | { type: "position"; position: NativeCaptureFilePosition }
    | { type: "cancel" }
    | { type: "preview-accepted" },
): void => {
  if (message.type === "preview-accepted") {
    previewInFlight = false;
    flushPreview();
    return;
  }
  if (message.type === "cancel") {
    cancellation.abort();
    return;
  }
  if (message.type === "position") {
    latest = message.position;
    process.send?.({ type: "accepted" });
    return;
  }
  if (started) {
    return;
  }
  started = true;
  latest = message.position;
  void runLiveBusAnalysis(message).then(
    (value) => settle({ type: "result", value }),
    (error: unknown) =>
      settle({ type: "error", error: error instanceof Error ? error.message : String(error) }),
  );
};

if (typeof process.send === "function") {
  process.on("disconnect", () => process.exit(0));
  process.on("message", handleLiveBusProcessMessage);
}

/** Catch up using bounded read slices. Aborting or exceeding lag discards the temp index,
 * leaving the native recording and completed archive available for an offline retry.
 * @param {LiveBusStart} options Session identity, project and resource budgets fixed at startup.
 * @returns {Promise<object>} Published result and bounded runtime measurements after END2 validation.
 */
export async function runLiveBusAnalysis(options: LiveBusStart) {
  // Time slice/stage boundaries only. Per-event clocks would distort the hot loop.
  const profile: LiveBusProfile | undefined = options.profile
    ? { cursorMs: 0, yields: 0, yieldMs: 0, idleWaits: 0, idleMs: 0, stages: {} }
    : undefined;
  let stage = "Opening capture";
  let stageStarted = profile ? performance.now() : 0;
  const onStage = (next: string): void => {
    if (!profile) {
      return;
    }
    const now = performance.now();
    profile.stages[stage] = (profile.stages[stage] ?? 0) + now - stageStarted;
    stageStarted = now;
    stage = next;
  };
  if (
    ![options.maxLagBytes, options.maxBytes, options.maxIndexRecords].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  ) {
    throw new Error("Invalid live analysis budgets.");
  }
  // Start is sent while the recorder owns a prepared partial inode. Publication
  // can win this race for a short capture. The cursor still checks its session.
  let cursor: NativeCaptureFileCursor;
  try {
    cursor = await NativeCaptureFileCursor.open(options.file + ".partial", {
      signal: cancellation.signal,
      maxBytes: options.maxBytes,
    });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
    cursor = await NativeCaptureFileCursor.open(options.file, {
      signal: cancellation.signal,
      maxBytes: options.maxBytes,
    });
  }
  let lastProgress = -Infinity;
  let peakLagBytes = 0;
  const startedAt = performance.now();
  try {
    const metadata = validateRuntimeBusTraceMetadata({
      ...cursor.header,
      format: "uttori-asm-bus-trace",
      schemaVersion: 1,
    });
    if (metadata.session !== options.position.session) {
      throw new Error("Live capture session changed before opening.");
    }
    const result = await importRuntimeBusTraceSourceIntoProject(
      {
        metadata,
        completedFile: options.file,
        read: async (accept) => {
          while (!cursor.complete) {
            cancellation.signal.throwIfAborted();
            const position = latest!;
            const lag = Number(position.fileBytes) - cursor.readBytes;
            peakLagBytes = Math.max(peakLagBytes, lag);
            // The archive is the lossless spool. Limit analysis lag explicitly rather
            // than accumulating raw buffers or slowing the emulator to feed the UI.
            if (lag > options.maxLagBytes) {
              throw new Error(
                "Live analysis exceeded its lag budget. Recording continues. Import the completed archive offline.",
              );
            }
            const sliceStarted = profile ? performance.now() : 0;
            // Replay benchmarks found little benefit from 256 rather than 16 chunks.
            // Keep the smaller batch to bound work before rereading the latest status.
            await cursor.readThrough(
              position,
              (chunk) => {
                if ("instructions" in chunk || chunk.scope === "nes.cpu-bus-ppu") {
                  throw new Error("Live bus analysis requires bus scope.");
                }
                accept({
                  accesses: chunk.scope === "snes.cpu-bus" ? chunk.accesses : chunk.events,
                });
              },
              16,
              options.file,
            );
            if (profile) {
              profile.cursorMs += performance.now() - sliceStarted;
            }
            const waitStarted = profile ? performance.now() : 0;
            // Drain existing backlog without an artificial 5 ms pause. Still
            // yield a full event-loop turn for IPC/cancellation, including once
            // after END2 before entering synchronous publication. This services
            // queued cancellation but does not make the transaction interruptible.
            if (captureCursorComplete(cursor) || cursor.readBytes < Number(position.fileBytes)) {
              await yieldToMessages(undefined, { signal: cancellation.signal });
              if (profile) {
                profile.yields++;
                profile.yieldMs += performance.now() - waitStarted;
              }
            } else {
              // Once this durable prefix is exhausted, sleep to avoid a busy poll.
              // Applying this delay to every slice instead would cap catch-up speed.
              await delay(5, undefined, { signal: cancellation.signal });
              if (profile) {
                profile.idleWaits++;
                profile.idleMs += performance.now() - waitStarted;
              }
            }
          }
        },
      },
      options.projectDirectory,
      {
        projectRomContentSha256: metadata.romContentSha256,
        sourceName: options.file.split(/[/\\]/).at(-1)!,
        maxIndexRecords: options.maxIndexRecords,
        onProgress: (progress) => {
          const now = performance.now();
          if (now - lastProgress < 200) {
            return;
          }
          lastProgress = now;
          pendingPreview = {
            type: "progress",
            progress: {
              ...progress,
              readBytes: cursor.readBytes,
              durableBytes: Number(latest!.fileBytes),
              provisional: true,
            },
          };
          flushPreview();
        },
      },
      { signal: cancellation.signal, onStage: profile ? onStage : undefined },
    );
    onStage("done");
    return {
      ...result,
      live: {
        wallMs: performance.now() - startedAt,
        peakLagBytes,
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
        ...(profile ? { profile } : {}),
      },
    };
  } finally {
    await cursor.close();
  }
}

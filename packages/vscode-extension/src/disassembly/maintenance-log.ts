import type { MaintenanceProgress } from "./maintenance-jobs.js";

/** Diagnostic destination supplied by the editor. Tests and CLI callers need no VS Code module. */
export interface MaintenanceLogSink {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Convert elapsed milliseconds to seconds with one decimal place for compact diagnostic
 * messages.
 * @param {number} milliseconds Elapsed wall-clock milliseconds.
 * @returns {string} Seconds rounded to one decimal with an s suffix.
 */
const seconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)}s`;
/**
 * Convert byte counts to binary MiB with one decimal place for worker diagnostics.
 * @param {number} bytes Read or retained byte count.
 * @returns {string} Binary MiB rounded to one decimal.
 */
const mib = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} MiB`;

/**
 * One worker's diagnostics. Counts are throttled to five seconds. A parent-owned heartbeat
 * reports silence without claiming the synchronous worker has made additional progress.
 */
export class MaintenanceLog {
  readonly #started: number;
  #lastWorker: number;
  #lastCount = -Infinity;
  #lastHeartbeat: number;
  #stageStarted: number;
  #stage = "Starting worker";
  #counts = "";
  #stderr = "";

  constructor(
    readonly sink: MaintenanceLogSink,
    readonly label: string,
    readonly now: () => number = () => performance.now(),
  ) {
    this.#started = this.#lastWorker = this.#lastHeartbeat = this.#stageStarted = now();
    this.#write("info", "Started");
  }

  /** Worker-reported phase/timing/counters. Counters never close a measured phase.
   * @param {MaintenanceProgress} value Latest worker message, including provisional counts.
   */
  progress(value: MaintenanceProgress): void {
    const now = this.now();
    this.#lastWorker = now;
    if (value.timing) {
      this.#write(
        "info",
        `${value.timing.status}: ${value.timing.step} (${seconds(value.timing.durationMs)})`,
      );
      return;
    }
    if (value.message && value.message !== this.#stage) {
      this.#stage = value.message;
      this.#stageStarted = now;
      this.#counts = "";
      this.#lastCount = -Infinity;
      this.#write("info", value.message);
    }
    let complete = false;
    if (value.processedRecords !== undefined && value.totalRecords !== undefined) {
      this.#counts = `${value.processedRecords.toLocaleString("en-US")} / ${value.totalRecords.toLocaleString("en-US")} provisional records merged`;
      complete = value.processedRecords === value.totalRecords;
    } else if (value.bytesRead !== undefined && value.totalBytes !== undefined) {
      const percent = value.totalBytes > 0 ? (value.bytesRead / value.totalBytes) * 100 : 100;
      this.#counts = `${mib(value.bytesRead)} / ${mib(value.totalBytes)} read (${percent.toFixed(1)}%)`;
      complete = value.bytesRead === value.totalBytes;
    } else {
      return;
    }
    if (complete || now - this.#lastCount >= 5000) {
      this.#write(
        "info",
        `${this.#stage}: ${this.#counts}. Stage ${seconds(now - this.#stageStarted)}`,
      );
      this.#lastCount = now;
    }
  }

  /** Bound stderr retained between heartbeat flushes, including native warnings on successful runs.
   * @param {string} text Native stderr chunk. Only the last 8192 characters are retained.
   */
  stderr(text: string): void {
    this.#stderr = (this.#stderr + text).slice(-8192);
  }

  /** Called by the parent every ten seconds, even while the worker is inside synchronous SQLite. */
  tick(): void {
    this.#flushStderr();
    const now = this.now();
    if (now - this.#lastHeartbeat < 10000) {
      return;
    }
    this.#lastHeartbeat = now;
    const silence = now - this.#lastWorker;
    if (silence < 10000) {
      return;
    }
    const detail = this.#counts ? `. Last count: ${this.#counts}` : "";
    this.#write(
      silence >= 60000 ? "warn" : "info",
      `Waiting for worker: ${this.#stage}. Stage ${seconds(now - this.#stageStarted)}. No new worker progress for ${seconds(silence)}${detail}.`,
    );
  }

  /** Log the settled result. Cancellation may follow a safe commit.
   * @param {Error} [error] Process/operation failure, or absent after a successful worker exit.
   */
  finish(error?: Error): void {
    this.#flushStderr();
    if (error) {
      this.#write(error.name === "AbortError" ? "warn" : "error", error.stack ?? error.message);
    } else {
      this.#write("info", "Completed. Worker exited");
    }
  }

  #flushStderr(): void {
    if (!this.#stderr) {
      return;
    }
    this.#write("warn", `Worker stderr: ${this.#stderr.trim()}`);
    this.#stderr = "";
  }

  #write(level: keyof MaintenanceLogSink, message: string): void {
    // Diagnostics must not turn a successful publication into an apparent failure if a sink closes.
    try {
      this.sink[level](`[${this.label} +${seconds(this.now() - this.#started)}] ${message}`);
    } catch {
      /* The worker outcome remains authoritative. */
    }
  }
}

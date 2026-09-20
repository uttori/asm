import { performance } from "node:perf_hooks";

/** Elapsed wall-clock milliseconds for a completed or interrupted processing stage. */
export interface MaintenanceStageTiming {
  readonly step: string;
  readonly durationMs: number;
  readonly status: "completed" | "failed" | "cancelled";
}

/** A parent operation includes process startup, IPC and shutdown. Details are contained within it. */
export interface MaintenanceStepTiming extends MaintenanceStageTiming {
  readonly details: readonly MaintenanceStageTiming[];
}

/** Processing time excludes user selection and report display, and counts child stages only once. */
export interface MaintenanceTimingSummary {
  readonly steps: readonly MaintenanceStepTiming[];
  readonly totalMs: number;
}

/** Collect sequential workflow timings without changing results, exceptions or cancellation. */
export class DisassemblyTimings {
  readonly #steps: MaintenanceStepTiming[] = [];

  /** The injectable clock must return monotonic milliseconds, like performance.now(). */
  constructor(private readonly now: () => number = () => performance.now()) {}

  /**
   * Time one operation without swallowing its exception or cancellation.
   * @param {string} step Human-readable parent phase.
   * @param {Function} action Operation receiving a callback for contained worker stages.
   * @returns {Promise<T>} The original operation result.
   */
  async measure<T>(
    step: string,
    action: (recordStage: (stage: MaintenanceStageTiming) => void) => T | Promise<T>,
  ): Promise<T> {
    const started = this.now();
    const details: MaintenanceStageTiming[] = [];
    let status: MaintenanceStageTiming["status"] = "completed";
    try {
      return await action((stage) => details.push(stage));
    } catch (error) {
      status = error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed";
      throw error;
    } finally {
      this.#steps.push({ step, durationMs: this.now() - started, status, details });
    }
  }

  /**
   * Copy finished measurements so later import/report phases cannot mutate an earlier result.
   * @returns {MaintenanceTimingSummary} Finished steps and their total, excluding contained stages.
   */
  snapshot(): MaintenanceTimingSummary {
    const steps = this.#steps.map((step) => ({ ...step, details: [...step.details] }));
    return { steps, totalMs: steps.reduce((total, step) => total + step.durationMs, 0) };
  }
}

/**
 * Format wall-clock milliseconds to one decimal below a second, otherwise seconds to three
 * decimals.
 * @param {number} milliseconds Elapsed wall-clock milliseconds.
 * @returns {string} Human-readable ms or s value with fixed precision.
 */
const duration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(1)} ms`;
  }
  return `${(milliseconds / 1000).toFixed(3)} s`;
};

/**
 * Escape table delimiters and flatten newlines in timing labels so each label stays within one
 * Markdown cell.
 * @param {string} text Unescaped timing label.
 * @returns {string} Single-line Markdown table content with escaped pipes.
 */
const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

/**
 * Render parent costs and contained worker stages separately to avoid double-counting totals.
 * @param {MaintenanceTimingSummary} summary Finished processing measurements.
 * @returns {string} Markdown timing section, including failures and the slowest parent step.
 */
export const renderMaintenanceTimings = (summary: MaintenanceTimingSummary): string => {
  const slowest = summary.steps.reduce<MaintenanceStepTiming | undefined>(
    (largest, step) => (!largest || step.durationMs > largest.durationMs ? step : largest),
    undefined,
  );
  const rows = summary.steps.map((step) => {
    const share = summary.totalMs > 0 ? (step.durationMs / summary.totalMs) * 100 : 0;
    return `| ${cell(step.step)} | ${duration(step.durationMs)} | ${share.toFixed(1)}% | ${step.status} |`;
  });
  const details = summary.steps.flatMap((step) =>
    step.details.map(
      (detail) =>
        `| ${cell(step.step)} | ${cell(detail.step)} | ${duration(detail.durationMs)} | ${detail.status} |`,
    ),
  );
  return [
    "## Step timings",
    "",
    "| Step | Duration | Share of processing | Status |",
    "| --- | ---: | ---: | --- |",
    ...rows,
    `| **Total measured processing** | **${duration(summary.totalMs)}** | | |`,
    "",
    ...(slowest
      ? [`Slowest step: **${cell(slowest.step)}** (${duration(slowest.durationMs)}).`, ""]
      : []),
    "Wall-clock durations include worker startup, communication and shutdown. User selections and opening the report are excluded. Cached work is included at its actual measured cost.",
    "",
    ...(details.length
      ? [
          "### Worker stage details",
          "",
          "These stages are included in their parent step above. They are not added again to the total. Remaining parent time includes process overhead.",
          "",
          "| Parent step | Stage | Duration | Status |",
          "| --- | --- | ---: | --- |",
          ...details,
          "",
        ]
      : []),
  ].join("\n");
};

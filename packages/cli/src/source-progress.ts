/**
 * Report provisional SQLite merge counts at most every five seconds, plus start and completion.
 * Rates and remaining time are estimates for this phase, not a promise that publication has committed.
 * The monotonic clock is injectable so throttling and estimates can be verified without waiting.
 */
export function createSourceMergeProgress(
  report?: (message: string) => void,
  now: () => number = () => performance.now(),
): (processed: number, total: number) => void {
  let started: number | undefined;
  let lastReported: number | undefined;
  return (processed, total) => {
    if (!report) {
      return;
    }
    const current = now();
    started ??= current;
    if (lastReported !== undefined && processed !== total && current - lastReported < 5000) {
      return;
    }
    lastReported = current;
    const percent = total ? (processed / total) * 100 : 100;
    let estimate = "";
    const seconds = (current - started) / 1000;
    if (seconds > 0 && processed > 0 && processed < total) {
      const rate = processed / seconds;
      estimate = `; ${Math.round(rate).toLocaleString("en-US")} records/s; estimated ${Math.ceil((total - processed) / rate)}s remaining`;
    }
    report(
      `Merging runtime facts: ${processed.toLocaleString("en-US")}/${total.toLocaleString("en-US")} records (${percent.toFixed(1)}%${estimate}); provisional until commit.`,
    );
  };
}

import type { AnalysisStorageSnapshot } from "@uttori/asm-disassembler";

/** Display binary storage units consistently with the project's byte budgets.
 * @param {number} bytes Allocated or retained byte count.
 * @returns {string} Binary MiB rounded for a human-readable report.
 */
const mib = (bytes: number): string => `${(bytes / 1024 ** 2).toFixed(1)} MiB`;

/** Durable facts, compact source relationships and database allocation are accounted separately.
 * @param {AnalysisStorageSnapshot} before Allocation before processing.
 * @param {AnalysisStorageSnapshot} after Allocation after processing.
 * @returns {string} Markdown storage comparison and interpretation.
 */
export const renderDisassemblyStorage = (
  before: AnalysisStorageSnapshot,
  after: AnalysisStorageSnapshot,
): string =>
  [
    "## Storage",
    "",
    "| Component | Before | After |",
    "| --- | ---: | ---: |",
    `| SQLite file | ${mib(before.databaseBytes)} | ${mib(after.databaseBytes)} |`,
    `| WAL allocation | ${mib(before.walBytes)} | ${mib(after.walBytes)} |`,
    `| Live database pages | ${mib(before.livePageBytes)} | ${mib(after.livePageBytes)} |`,
    `| Free database pages | ${mib(before.freePageBytes)} | ${mib(after.freePageBytes)} |`,
    `| Shared runtime facts | ${before.facts} | ${after.facts} |`,
    `| Capture/fact relationships | ${before.observations} | ${after.observations} |`,
    `| Virtual paired CPU states | ${before.pairedStates} | ${after.pairedStates} |`,
    `| Durable capture receipts | ${before.captures} | ${after.captures} |`,
    "",
    "WAL bytes are allocated transaction space. Free pages are reusable; explicit compaction releases them to the filesystem.",
  ].join("\n");

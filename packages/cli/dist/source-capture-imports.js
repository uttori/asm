import path from "node:path";
/** Validate the worker result while retaining only bounded metadata across a large queue. */
function summarize(capture, result) {
    if (typeof result !== "object" ||
        result === null ||
        !("sourceSha256" in result) ||
        typeof result.sourceSha256 !== "string" ||
        !("changed" in result) ||
        typeof result.changed !== "boolean" ||
        !("added" in result) ||
        typeof result.added !== "object" ||
        result.added === null ||
        !("runtime" in result.added) ||
        typeof result.added.runtime !== "number" ||
        !("evidence" in result.added) ||
        typeof result.added.evidence !== "number" ||
        !("warnings" in result) ||
        !Array.isArray(result.warnings) ||
        result.warnings.some((warning) => typeof warning !== "string")) {
        throw new Error("Invalid capture import result.");
    }
    return {
        capture,
        sourceSha256: result.sourceSha256,
        changed: result.changed,
        added: { runtime: result.added.runtime, evidence: result.added.evidence },
        warnings: result.warnings,
    };
}
/**
 * Import unique absolute paths in selection order, reopening project state for each capture.
 * Stop on the first failure/cancellation; completed files remain committed and retries are idempotent.
 * The callback owns each file's transaction and catalog update. No captures run concurrently.
 */
export async function importSourceCaptures(captures, run, options = {}) {
    if (!Array.isArray(captures) ||
        !captures.length ||
        captures.some((capture) => typeof capture !== "string" || !capture.trim())) {
        throw new Error("Bulk import requires at least one non-empty capture archive path.");
    }
    // Normalize before deduplication so selecting the same file through two relative paths cannot
    // inflate queue totals. Distinct copies still pass through the importer's content identity checks.
    const files = [...new Set(captures.map((capture) => path.resolve(capture)))];
    const imports = [];
    for (const [index, capture] of files.entries()) {
        const prefix = `Capture ${index + 1}/${files.length} (${capture})`;
        const report = (message) => {
            // Single-file operations also identify their source. The queue prefix already contains it.
            const filePrefix = `Import ${capture}: `;
            const detail = message.startsWith(filePrefix) ? message.slice(filePrefix.length) : message;
            options.onProgress?.(`${prefix}: ${detail}`);
        };
        try {
            options.signal?.throwIfAborted();
            report("Starting import.");
            const result = summarize(capture, await run(capture, report));
            imports.push(result);
            report(`Import completed; added ${result.added.runtime} runtime records and ${result.added.evidence} evidence records.`);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`${prefix}: Import stopped. ${imports.length} completed; ${files.length - index - 1} unattempted. Completed imports remain committed; retrying the queue is safe. ${detail}`, { cause: error });
        }
    }
    return { imports };
}
//# sourceMappingURL=source-capture-imports.js.map
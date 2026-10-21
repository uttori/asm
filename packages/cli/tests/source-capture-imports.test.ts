import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { importSourceCaptures } from "../../workflows/src/source-capture-imports.js";
import { createSourceMergeProgress } from "../../workflows/src/source-progress.js";

/** An import outcome with deliberately large navigation data that a queue should not retain. */
const result = {
  sourceSha256: "a".repeat(64),
  changed: true,
  added: { runtime: 2, evidence: 1 },
  warnings: ["Maintenance deferred."],
  execution: [{ address: 0x808000 }],
};

test("capture queues run sequentially, deduplicate paths and retain compact per-file outcomes", async (t) => {
  const files: string[] = [];
  const progress: string[] = [];
  let active = 0;
  const imported = await importSourceCaptures(
    ["one.json", "./one.json", "two.act2"],
    async (file, report) => {
      t.is(active++, 0);
      await Promise.resolve();
      files.push(file);
      report(`Import ${file}: Merging facts.`);
      active--;
      return result;
    },
    { onProgress: (message) => progress.push(message) },
  );
  t.deepEqual(files, [path.resolve("one.json"), path.resolve("two.act2")]);
  t.is(imported.imports.length, 2);
  t.deepEqual(imported.imports[0], {
    capture: files[0],
    sourceSha256: result.sourceSha256,
    changed: true,
    added: result.added,
    warnings: result.warnings,
  });
  t.true(progress.some((message) => message === `Capture 2/2 (${files[1]}): Merging facts.`));
});

for (const cancel of [false, true]) {
  test(`capture queues preserve completed imports and stop after ${cancel ? "cancellation" : "a file failure"}`, async (t) => {
    const abort = new AbortController();
    const files: string[] = [];
    const imported = importSourceCaptures(
      ["one.json", "bad.json", "unattempted.json"],
      async (file) => {
        files.push(file);
        if (files.length === 2) {
          throw new Error("Invalid archive.");
        }
        if (cancel) {
          abort.abort(new Error("Import cancelled."));
        }
        return result;
      },
      { signal: abort.signal },
    );
    const error = await t.throwsAsync(imported, {
      message: /bad.json.*1 completed; 1 unattempted.*remain committed/,
    });
    t.regex(error!.message, cancel ? /Import cancelled/ : /Invalid archive/);
    t.is(files.length, cancel ? 1 : 2);
  });
}

test("invalid capture queues fail before starting any import", async (t) => {
  for (const captures of [[], [""], ["ok.json", " "]]) {
    await t.throwsAsync(
      importSourceCaptures(captures, async () => {
        t.fail("invalid queue executed an import");
      }),
      { message: /at least one non-empty/ },
    );
  }
});

test("merge progress reports meaningful rates and estimates without flooding Output", (t) => {
  let current = 0;
  const messages: string[] = [];
  const progress = createSourceMergeProgress(
    (message) => messages.push(message),
    () => current,
  );
  progress(0, 1000);
  current = 1000;
  progress(100, 1000);
  t.is(messages.length, 1);
  current = 5000;
  progress(500, 1000);
  t.regex(messages[1], /500\/1,000 records \(50.0%; 100 records\/s; estimated 5s remaining\)/);
  current = 5100;
  progress(1000, 1000);
  t.regex(messages[2], /1,000\/1,000 records \(100.0%\); provisional until commit/);
  t.is(messages.length, 3);
});

test("empty merge progress never divides by zero or invents an estimate", (t) => {
  const messages: string[] = [];
  createSourceMergeProgress(
    (message) => messages.push(message),
    () => 0,
  )(0, 0);
  t.deepEqual(messages, ["Merging runtime facts: 0/0 records (100.0%); provisional until commit."]);
});

import { test } from "../../../../tests/ava-helper.js";
import { MaintenanceLog } from "../../src/disassembly/maintenance-log.js";

test("maintenance diagnostics throttle counts, retain final totals and distinguish worker silence", (t) => {
  let now = 0;
  const lines: string[] = [];
  const sink = {
    info: (s: string) => lines.push(s),
    warn: (s: string) => lines.push(`WARN ${s}`),
    error: (s: string) => lines.push(`ERROR ${s}`),
  };
  const log = new MaintenanceLog(sink, "import pid=123", () => now);
  log.progress({ message: "Reading capture" });
  log.progress({ bytesRead: 100, totalBytes: 1000 });
  const first = lines.length;
  now = 1000;
  log.progress({ bytesRead: 200, totalBytes: 1000 });
  t.is(lines.length, first);
  now = 5000;
  log.progress({ bytesRead: 300, totalBytes: 1000 });
  t.is(lines.length, first + 1);
  log.progress({ bytesRead: 1000, totalBytes: 1000 });
  t.true(lines.at(-1)!.includes("100.0%"));
  log.progress({ message: "Merging" });
  log.progress({ processedRecords: 0, totalRecords: 10 });
  now = 6000;
  log.progress({ processedRecords: 10, totalRecords: 10 });
  t.true(lines.at(-1)!.includes("10 / 10 provisional records"));
  now = 16000;
  log.tick();
  t.true(lines.at(-1)!.includes("No new worker progress for 10.0s"));
  t.true(lines.at(-1)!.includes("Stage 11.0s"));
  now = 66000;
  log.tick();
  t.true(lines.at(-1)!.startsWith("WARN"));
  log.progress({ timing: { step: "Merging", durationMs: 61000, status: "completed" } });
  t.true(lines.at(-1)!.includes("completed: Merging (61.0s)"));
  log.stderr("native warning");
  log.finish();
  t.true(lines.at(-2)!.includes("Worker stderr: native warning"));
  t.true(lines.at(-1)!.includes("Completed. Worker exited"));
});

test("maintenance logs keep failure/cancellation context and tolerate a closed output sink", (t) => {
  const lines: string[] = [];
  const sink = {
    info: (s: string) => lines.push(s),
    warn: (s: string) => lines.push(s),
    error: (s: string) => lines.push(s),
  };
  const log = new MaintenanceLog(sink, "import pid=456", () => 0);
  log.finish(new Error("bad capture tail"));
  t.true(lines.at(-1)!.includes("bad capture tail"));
  const abort = Object.assign(new Error("cancelled after current step"), { name: "AbortError" });
  log.finish(abort);
  t.true(lines.at(-1)!.includes("AbortError"));
  const fail = () => {
    throw new Error("closed sink");
  };
  t.notThrows(() => new MaintenanceLog({ info: fail, warn: fail, error: fail }, "closed").finish());
});

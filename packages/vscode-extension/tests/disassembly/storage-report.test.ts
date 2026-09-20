import type { AnalysisStorageSnapshot } from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import { renderDisassemblyStorage } from "../../src/disassembly/storage-report.js";

const snapshot = (overrides: Partial<AnalysisStorageSnapshot> = {}): AnalysisStorageSnapshot => ({
  databaseBytes: 2 * 1024 ** 2,
  walBytes: 512 * 1024,
  livePageBytes: 1024 ** 2,
  freePageBytes: 256 * 1024,
  facts: 10,
  observations: 4,
  pairedStates: 2,
  captures: 1,
  ...overrides,
});

test("storage report uses binary MiB and keeps before/after columns aligned", (t) => {
  const report = renderDisassemblyStorage(
    snapshot(),
    snapshot({
      databaseBytes: 4 * 1024 ** 2,
      facts: 12,
      captures: 0,
    }),
  );
  t.true(report.startsWith("## Storage\n"));
  t.true(report.includes("| SQLite file | 2.0 MiB | 4.0 MiB |"));
  t.true(report.includes("| WAL allocation | 0.5 MiB | 0.5 MiB |"));
  t.true(report.includes("| Shared runtime facts | 10 | 12 |"));
  t.true(report.includes("| Durable capture receipts | 1 | 0 |"));
  t.true(report.includes("Free pages are reusable"));
});

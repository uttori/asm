import { test } from "../../../../tests/ava-helper.js";
import { TraceCache } from "../../src/internal/trace-cache.js";

const byKey = (a: [string, number], b: [string, number]) => a[0].localeCompare(b[0]);

test("bounded cache preserves values and reports every eviction across rotating and unique scans", (t) => {
  const metrics = { hits: 0, misses: 0, evictions: 0, peakEntries: 0 };
  const cache = new TraceCache<{ count: number }>(metrics);
  const totals = new Map<string, number>();
  const expected = new Map<string, number>();
  const persist = (key: string, count: number) => totals.set(key, (totals.get(key) ?? 0) + count);
  for (let i = 0; i < 65536; i++) {
    const key = String(i < 32768 ? i % 4097 : i);
    expected.set(key, (expected.get(key) ?? 0) + 1);
    const entry = cache.get(key);
    if (entry) {
      entry.count++;
    } else {
      const evicted = cache.insert(key, { count: 1 });
      if (evicted) {
        persist(evicted.key, evicted.value.count);
      }
    }
  }
  for (const [key, value] of cache.entries()) {
    persist(key, value.count);
  }
  // Compare ordered arrays: unordered large Map matching can make the assertion
  // itself quadratic even though aggregation is linear.
  t.deepEqual([...totals].toSorted(byKey), [...expected].toSorted(byKey));
  t.is(metrics.peakEntries, 4096);
  t.true(metrics.hits > 28000);
  t.is(metrics.evictions, metrics.misses - 4096);
  cache.clear();
  t.is([...cache.entries()].length, 0);
  t.is(cache.get("0"), undefined);
  cache.insert("0", { count: 7 });
  t.is(cache.get("0")?.count, 7);
});

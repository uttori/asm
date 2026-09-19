import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  RootAnalysisCache,
  fingerprintFor,
  hashBytes,
  type CachedRootAnalysis,
  type RootAnalysisCacheIdentity,
} from "../../src/lsp/root-analysis-cache.js";

const identity: RootAnalysisCacheIdentity = {
  target: "test",
  architecture: "cpu",
  includePaths: ["a", "b"],
};
const analysis: CachedRootAnalysis = {
  followedIncludes: true,
  diagnostics: [],
  symbols: [],
  references: [],
  includeEdges: [],
};

/** Create a real persisted entry so corruption, timestamps, and I/O failures exercise disk behavior. */
const fixture = (t: { teardown(callback: () => void): void }) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "root-analysis-cache-"));
  t.teardown(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "main.asm");
  writeFileSync(root, "db 1\n");
  const cache = new RootAnalysisCache(path.join(directory, "cache"));
  const hash = hashBytes(readFileSync(root));
  cache.write(root, identity, { [root]: hash }, { [root]: statSync(root).mtimeMs }, analysis);
  const payload = JSON.parse(readFileSync(cache.entryPath(root), "utf8"));
  return { directory, root, cache, hash, payload };
};

test("root analysis reuses unchanged timestamps and treats include path order as equivalent", (t) => {
  const { root, cache } = fixture(t);
  t.deepEqual(
    cache.read(root, { ...identity, includePaths: ["b", "a"] }, () => {
      t.fail("an unchanged timestamp should avoid hashing");
      return undefined;
    }),
    analysis,
  );
  cache.invalidate(root);
  t.is(
    cache.read(root, identity, () => "unused"),
    undefined,
  );
  t.notThrows(() => cache.invalidate(root));
});

test("root analysis rehashes changed timestamps and old entries without mtimes", (t) => {
  const { root, cache, hash, payload } = fixture(t);
  // Set a fixed different timestamp instead of relying on filesystem clock resolution.
  utimesSync(root, 1000, 1000);
  let calls = 0;
  t.deepEqual(
    cache.read(root, identity, (file) => {
      calls++;
      t.is(file, root);
      return hash;
    }),
    analysis,
  );
  t.is(calls, 1);
  delete payload.fileMtimes;
  writeFileSync(cache.entryPath(root), JSON.stringify(payload));
  t.deepEqual(
    cache.read(root, identity, () => hash),
    analysis,
  );
  t.is(
    cache.read(root, identity, () => "changed"),
    undefined,
  );
  t.is(
    cache.read(root, identity, () => undefined),
    undefined,
  );
});

test("root analysis treats missing sources and failed hashers as cache misses", (t) => {
  const { root, cache } = fixture(t);
  rmSync(root);
  t.is(
    cache.read(root, identity, () => undefined),
    undefined,
  );
  t.is(
    cache.read(root, identity, () => {
      throw new Error("read failed");
    }),
    undefined,
  );
});

test("root analysis rejects incompatible, corrupt, and tampered cache entries", (t) => {
  const { root, cache, payload, hash } = fixture(t);
  for (const changed of [
    { ...identity, target: "other" },
    { ...identity, architecture: "other" },
    { ...identity, includePaths: ["a"] },
    { ...identity, includePaths: ["a", "c"] },
  ]) {
    t.is(
      cache.read(root, changed, () => hash),
      undefined,
    );
  }
  for (const changes of [
    { version: 999 },
    { root: "wrong" },
    { fingerprint: "tampered" },
    { identity: null },
    { fileHashes: null },
  ]) {
    writeFileSync(cache.entryPath(root), JSON.stringify({ ...payload, ...changes }));
    t.is(
      cache.read(root, identity, () => hash),
      undefined,
    );
  }
  writeFileSync(cache.entryPath(root), "{truncated");
  t.is(
    cache.read(root, identity, () => hash),
    undefined,
  );
});

test("cache writes and invalidations cannot fail the caller when the cache path is unusable", (t) => {
  const { root } = fixture(t);
  const cache = new RootAnalysisCache(root);
  t.notThrows(() => cache.write(root, identity, {}, {}, analysis));
  t.notThrows(() => cache.invalidate(root));
});

test("cache content fingerprints are independent of key insertion order", (t) => {
  t.is(
    hashBytes(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  t.is(fingerprintFor({ b: "2", a: "1" }), fingerprintFor({ a: "1", b: "2" }));
  t.not(fingerprintFor({ a: "1" }), fingerprintFor({ a: "2" }));
});

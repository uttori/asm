import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { publishSourceBuild } from "../../src/source-project/build-publication.js";

for (const extension of ["sfc", "nes"]) {
  test(`${extension} publication keeps the last complete pair through failure and preserves foreign files during retention`, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-publication-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const options = (id: number) => {
      const inputSha256 = id.toString(16).padStart(64, "0");
      const outputFile = path.join(directory, inputSha256, `output.${extension}`);
      return {
        directory,
        receipt: {
          inputSha256,
          outputFile,
          debugMapFile: outputFile + ".debug.json",
          coverage: {
            romSha256: "a".repeat(64),
            totalBytes: 10,
            remainingBytes: 10 - id,
            convertedBytes: id,
          },
        },
        output: Uint8Array.of(id),
        debugMap: JSON.stringify({ id }),
      };
    };
    const first = options(1);
    publishSourceBuild(first);
    fs.writeFileSync(path.join(directory, first.receipt.inputSha256, "user-notes.txt"), "keep");
    const pointer = fs.readFileSync(path.join(directory, "current.json"), "utf8");
    const summary = fs.readFileSync(path.join(directory, "summary.json"), "utf8");
    t.true(summary.length < 1024);
    t.deepEqual(JSON.parse(summary), {
      version: 1,
      inputSha256: first.receipt.inputSha256,
      coverage: first.receipt.coverage,
    });
    const failed = options(2);
    fs.mkdirSync(failed.receipt.debugMapFile, { recursive: true });
    t.throws(() => publishSourceBuild(failed));
    t.is(fs.readFileSync(path.join(directory, "current.json"), "utf8"), pointer);
    t.is(fs.readFileSync(path.join(directory, "summary.json"), "utf8"), summary);
    t.deepEqual([...fs.readFileSync(first.receipt.outputFile)], [1]);
    fs.rmSync(failed.receipt.debugMapFile, { recursive: true });
    publishSourceBuild(failed);
    t.deepEqual([...fs.readFileSync(failed.receipt.outputFile)], [2]);
    let warnings: readonly string[] = [];
    for (let id = 3; id <= 7; id++) {
      warnings = publishSourceBuild(options(id)).cacheWarnings ?? [];
    }
    t.true(warnings.some((warning) => warning.includes(first.receipt.inputSha256)));
    t.is(
      fs.readFileSync(path.join(directory, first.receipt.inputSha256, "user-notes.txt"), "utf8"),
      "keep",
    );
    const owned = fs
      .readdirSync(directory)
      .filter((name) => /^[\da-f]{64}$/.test(name) && name !== first.receipt.inputSha256);
    t.is(owned.length, 1);
    const current = fs.readFileSync(path.join(directory, "current.json"), "utf8");
    const cancelled = new AbortController();
    cancelled.abort();
    t.throws(() => publishSourceBuild({ ...options(8), signal: cancelled.signal }));
    t.is(fs.readFileSync(path.join(directory, "current.json"), "utf8"), current);
    t.throws(
      () =>
        publishSourceBuild({
          ...options(7),
          receipt: { ...options(7).receipt, extra: "different" },
        }),
      { message: /different receipt/ },
    );
  });
}

test("large source inventories and legacy receipts do not disable automatic build retirement", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-large-build-retention-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const publish = (id: number) => {
    const inputSha256 = id.toString(16).padStart(64, "0");
    const outputFile = path.join(directory, inputSha256, "program.sfc");
    return publishSourceBuild({
      directory,
      receipt: {
        inputSha256,
        outputFile,
        debugMapFile: `${outputFile}.debug.json`,
        inputs: "source inventory ".repeat(20000),
      },
      output: Uint8Array.of(id),
      debugMap: "{}",
    });
  };
  const first = publish(1);
  const firstDirectory = path.dirname(first.outputFile);
  t.true(fs.statSync(path.join(firstDirectory, "build.json")).size > 65536);
  // Simulate a completed build from before bounded ownership markers existed.
  fs.unlinkSync(path.join(firstDirectory, "owner.json"));
  fs.writeFileSync(path.join(firstDirectory, ".DS_Store"), "Finder metadata");
  const second = publish(2);
  t.false(fs.existsSync(firstDirectory));
  t.is(second.cacheWarnings, undefined);
  const third = publish(3);
  t.false(fs.existsSync(path.dirname(second.outputFile)));
  t.deepEqual(fs.readdirSync(path.dirname(third.outputFile)).toSorted(), [
    "build.json",
    "owner.json",
    "program.sfc",
    "program.sfc.debug.json",
  ]);
  t.is(third.cacheWarnings, undefined);
});

test("abandoned attempts retire even when the next publication fails, preserving the current pair", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-failed-build-retention-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const receipt = (id: number) => {
    const inputSha256 = id.toString(16).padStart(64, "0");
    const outputFile = path.join(directory, inputSha256, "program.sfc");
    return { inputSha256, outputFile, debugMapFile: `${outputFile}.debug.json` };
  };
  const current = receipt(1);
  publishSourceBuild({ directory, receipt: current, output: Uint8Array.of(1), debugMap: "{}" });
  const pointer = fs.readFileSync(path.join(directory, "current.json"));
  const abandoned = receipt(2);
  fs.mkdirSync(path.dirname(abandoned.outputFile));
  fs.writeFileSync(
    path.join(path.dirname(abandoned.outputFile), "pending.json"),
    JSON.stringify(abandoned),
  );
  fs.writeFileSync(abandoned.outputFile, "partial");
  const failed = receipt(3);
  // A foreign directory makes publication fail while exercising normal preflight cleanup.
  fs.mkdirSync(failed.debugMapFile, { recursive: true });
  t.throws(() =>
    publishSourceBuild({ directory, receipt: failed, output: Uint8Array.of(3), debugMap: "{}" }),
  );
  t.false(fs.existsSync(path.dirname(abandoned.outputFile)));
  t.deepEqual(fs.readFileSync(path.join(directory, "current.json")), pointer);
  t.deepEqual([...fs.readFileSync(current.outputFile)], [1]);
});

test("an unavailable progress projection does not reject an already published ROM/map pair", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-summary-publication-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "summary.json"));
  const inputSha256 = "a".repeat(64);
  const outputFile = path.join(directory, inputSha256, "program.sfc");
  const result = publishSourceBuild({
    directory,
    receipt: { inputSha256, outputFile, debugMapFile: `${outputFile}.debug.json` },
    output: Uint8Array.of(1),
    debugMap: "{}",
  });
  t.true(result.cacheWarnings?.some((warning) => warning.includes("coverage summary")));
  t.is(
    JSON.parse(fs.readFileSync(path.join(directory, "current.json"), "utf8")).inputSha256,
    inputSha256,
  );
  t.deepEqual([...fs.readFileSync(result.outputFile)], [1]);
});

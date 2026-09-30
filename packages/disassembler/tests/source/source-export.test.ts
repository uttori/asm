import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../../tests/ava-helper.js";
import {
  compareByteImages,
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_MANIFEST,
  SOURCE_EXPORT_SCHEMA_VERSION,
  describeSourceExportFileIssue,
  inspectSourceExportFiles,
  loadSourceExportManifest,
  sourceExportSha256,
  validateSourceExportFiles,
  validateSourceExportInputs,
  type SourceExportManifest,
} from "../../src/index.js";

test("source export manifests validate generated hashes and byte differences", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-export-"));
  try {
    fs.writeFileSync(path.join(directory, "main.asm"), "db $42\n");
    fs.writeFileSync(path.join(directory, "extra.asm"), "db $00\n");
    fs.writeFileSync(path.join(directory, "ram-map.json"), "{}\n");
    const text = fs.readFileSync(path.join(directory, "main.asm"));
    const extra = fs.readFileSync(path.join(directory, "extra.asm"));
    const input = fs.readFileSync(path.join(directory, "ram-map.json"));
    const manifest: SourceExportManifest = {
      format: SOURCE_EXPORT_FORMAT,
      schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
      target: "fixture.target",
      architecture: "fixture.arch",
      mapper: "fixture",
      sourceProjectSha256: "a".repeat(64),
      rom: {
        sha256: "b".repeat(64),
        contentSha256: "b".repeat(64),
        fileSize: 1,
        contentSize: 1,
        headerSize: 0,
      },
      entrySource: "main.asm",
      buildConfiguration: "config.json",
      contentOutput: "build/content.bin",
      finalOutput: "build/final.bin",
      checksumPolicy: "preserve",
      inputs: [
        {
          path: "ram-map.json",
          kind: "metadata",
          size: input.length,
          sha256: sourceExportSha256(input),
        },
      ],
      files: [
        { path: "main.asm", kind: "source", size: text.length, sha256: sourceExportSha256(text) },
        {
          path: "extra.asm",
          kind: "source",
          size: extra.length,
          sha256: sourceExportSha256(extra),
        },
      ],
      spans: [
        {
          id: "raw:000000",
          source: "rom",
          addressSpace: "rom.file",
          start: 0,
          end: 1,
          role: "raw",
          file: "main.asm",
        },
      ],
    };
    fs.writeFileSync(path.join(directory, SOURCE_EXPORT_MANIFEST), canonicalJson(manifest));
    t.is(loadSourceExportManifest(directory).entrySource, "main.asm");
    t.notThrows(() => validateSourceExportFiles(directory));
    t.notThrows(() => validateSourceExportInputs(directory));
    fs.writeFileSync(path.join(directory, "ram-map.json"), '{"changed":true}\n');
    t.throws(() => validateSourceExportInputs(directory), { message: /changed/ });
    fs.writeFileSync(path.join(directory, "main.asm"), "db $43\n");
    const changed = inspectSourceExportFiles(directory);
    t.is(changed.length, 1);
    t.is(changed[0].actualSize, changed[0].expectedSize);
    t.regex(describeSourceExportFileIssue(changed[0]), /SHA-256 .*manifest expects/);
    t.throws(() => validateSourceExportFiles(directory), {
      message: /1 of 2 files.*SHA-256.*Regeneration stopped/s,
    });
    fs.writeFileSync(path.join(directory, "main.asm"), "db $430\n");
    fs.rmSync(path.join(directory, "extra.asm"));
    const issues = inspectSourceExportFiles(directory);
    t.is(issues.length, 2);
    t.regex(describeSourceExportFileIssue(issues[0]), /has 8 bytes \(manifest expects 7\)/);
    t.regex(describeSourceExportFileIssue(issues[1]), /is missing/);
    t.throws(() => validateSourceExportFiles(directory), {
      message: /2 of 2 files.*main\.asm.*extra\.asm.*--force/s,
    });
    t.like(compareByteImages(new Uint8Array([1, 2]), new Uint8Array([1, 3])), {
      equal: false,
      firstDifference: 1,
      expectedLength: 2,
      actualLength: 2,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

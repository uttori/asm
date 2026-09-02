import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  compareByteImages,
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_MANIFEST,
  SOURCE_EXPORT_SCHEMA_VERSION,
  canonicalSourceExportJson,
  loadSourceExportManifest,
  sourceExportSha256,
  validateSourceExportFiles,
  type SourceExportManifest,
} from "../src/index.js";

test("source export manifests validate generated hashes and byte differences", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-export-"));
  try {
    fs.writeFileSync(path.join(directory, "main.asm"), "db $42\n");
    const text = fs.readFileSync(path.join(directory, "main.asm"));
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
      files: [
        { path: "main.asm", kind: "source", size: text.length, sha256: sourceExportSha256(text) },
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
    fs.writeFileSync(
      path.join(directory, SOURCE_EXPORT_MANIFEST),
      canonicalSourceExportJson(manifest),
    );
    t.is(loadSourceExportManifest(directory).entrySource, "main.asm");
    t.notThrows(() => validateSourceExportFiles(directory));
    fs.writeFileSync(path.join(directory, "main.asm"), "db $43\n");
    t.throws(() => validateSourceExportFiles(directory), { message: /modified/ });
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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
  type AnalysisProject,
} from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import { readAnalysisSourceCatalog } from "../../src/analysis/sources-data.js";

const emptyShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  imports: [],
  evidence: [],
  runtime: [],
} as const;

test("source catalog reads validated identities without loading CFG or runtime history", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-catalog-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project: AnalysisProject = {
    manifest: {
      format: ANALYSIS_PROJECT_FORMAT,
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom: new RomImage(new Uint8Array(64), { headerSize: 0 }).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      ...emptyShards,
      evidence: [{ id: "manual", source: "manual", sourceId: "manual", confidence: "certain" }],
    },
  };
  writeAnalysisProject(directory, project);
  const catalog = readAnalysisSourceCatalog(directory);
  t.is(catalog.manifest.target, "fixture");
  t.is(catalog.sources.length, 1);
  t.deepEqual(catalog.sources[0]?.evidenceIds, ["manual"]);
});

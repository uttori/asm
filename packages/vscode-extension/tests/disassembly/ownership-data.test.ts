import fs from "node:fs";
import path from "node:path";

import { sourceExportSha256 } from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import { ownershipFixture } from "../../../../tests/helpers/ownership-fixture.js";
import { lookupDisassemblyAnnotation } from "../../src/disassembly/annotation-data.js";
import {
  DisassemblyOwnershipResolver,
  ownershipReport,
  ownershipStatus,
} from "../../src/disassembly/ownership-data.js";

test("source ownership chooses the colocated project among copies and annotation lookup needs no debug map", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const resolver = new DisassemblyOwnershipResolver();
  const projects = [
    { directory: path.join(f.directory, "copy"), manifest: f.snapshot.manifest },
    { directory: f.projectDirectory, manifest: f.snapshot.manifest },
  ];
  const result = resolver.resolve(f.file, f.text, f.line, 0, false, projects)!;
  t.is(result.project?.directory, f.projectDirectory);
  t.true(result.canAnnotate);
  t.is(result.owners[0].id, "imported.candy");
  t.is(result.generationStatus, "current");
  t.regex(ownershipReport(result), /not checked by this inspector/);
  const lookup = lookupDisassemblyAnnotation(f.snapshot, {
    maps: [],
    source: { file: f.file, sha256: sourceExportSha256(f.text), line: f.line, column: 0 },
  });
  t.is(lookup.choices[0].label?.id, "imported.candy");
  t.false(lookup.choices[0].hasInstruction);
});

test("dirty source, saved edits, changed inputs and ambiguous projects have distinct honest states", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const resolver = new DisassemblyOwnershipResolver();
  const project = { directory: f.projectDirectory, manifest: f.snapshot.manifest };
  const dirty = resolver.resolve(f.file, f.text + "\n", f.line, 0, true, [project])!;
  t.false(dirty.canAnnotate);
  t.deepEqual(dirty.owners, []);
  t.regex(ownershipStatus(dirty), /unsaved/);
  const external = resolver.resolve(f.file, f.text + "\n", f.line, 0, false, [project])!;
  t.regex(ownershipStatus(external), /external changes/);
  const pending = resolver.resolve(f.file, f.text, f.line, 0, false, [
    {
      ...project,
      manifest: { ...project.manifest, revision: (project.manifest.revision ?? 0) + 1 },
    },
  ])!;
  t.regex(ownershipStatus(pending), /Metadata saved.*pending/);
  fs.appendFileSync(path.join(f.sourceDirectory, "struct-map.json"), "\n");
  resolver.invalidate();
  const input = resolver.resolve(f.file, f.text, f.line, 0, false, [project])!;
  t.deepEqual(input.inputChanges, ["struct-map.json"]);
  const ambiguous = resolver.resolve(f.file, f.text, f.line, 0, false, [
    { ...project, directory: path.join(f.directory, "one") },
    { ...project, directory: path.join(f.directory, "two") },
  ])!;
  t.is(ambiguous.project, undefined);
  t.false(ambiguous.canAnnotate);
});

test("old exports request regeneration without attaching unverified owner identities", (t) => {
  const f = ownershipFixture();
  t.teardown(f.cleanup);
  const { ownershipFile: ignored, ...manifest } = f.manifest;
  void ignored;
  fs.writeFileSync(path.join(f.sourceDirectory, "generated-files.json"), JSON.stringify(manifest));
  const result = new DisassemblyOwnershipResolver().resolve(f.file, f.text, f.line, 0, false, [
    { directory: f.projectDirectory, manifest: f.snapshot.manifest },
  ])!;
  t.false(result.ownershipAvailable);
  t.false(result.canAnnotate);
  t.regex(ownershipStatus(result), /ownership map unavailable/);
});

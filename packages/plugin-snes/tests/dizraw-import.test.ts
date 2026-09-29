import * as fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../tests/ava-helper.js";
import { importDizRaw } from "../src/index.js";

const fixture = `<?xml version="1.0" encoding="utf-8"?>
<ProjectXmlSerializer-Root SaveVersion="104" Watermark="DiztinGUIsh">
  <Project InternalRomGameName="Fixture" InternalCheckSum="1">
    <LogWriterSettings Format="fixture" />
    <ProjectSettings />
    <Data RomMapMode="HiRom" RomSpeed="SlowRom">
      <Labels>
        <sys:Item Key="12648430"><Value Name="Entry" Comment="A &amp; B" Author="tester" Confidence="high" /></sys:Item>
      </Labels>
      <Comments><sys:Item Key="12648431"><Value>standalone &lt;comment&gt;</Value></sys:Item></Comments>
      <RomBytes>
version:201,compress_groupblocks
r 2 +P7E12341
U
      </RomBytes>
      <Regions><ns2:Region StartSnesAddress="12648430" EndSnesAddress="12648431" RegionName="Code" Priority="2" ExportSeparateFile="true" /></Regions>
    </Data>
  </Project>
</ProjectXmlSerializer-Root>`;

test(".dizraw import preserves metadata, state, labels, comments, regions, and loss", (t) => {
  const imported = importDizRaw(fixture, { sourceName: "fixture.dizraw" });
  t.is(imported.mapping.mapper, "hirom");
  t.is(imported.mapping.speed, "slow");
  t.is(imported.metadataBytes, 3);
  t.is(imported.shards.annotations.length, 2);
  t.deepEqual(imported.shards.annotations[0].state, {
    m: true,
    x: true,
    dataBank: 0x7e,
    directPage: 0x1234,
  });
  t.deepEqual(imported.shards.annotations[0].points, ["in", "out"]);
  t.is(imported.shards.annotations[0].architecture, "snes.spc700");
  t.is(imported.shards.labels[0].comment, "A & B");
  t.is(imported.shards.comments[0].text, "standalone <comment>");
  t.is(imported.shards.regions[0].end, 12648432);
  t.true(imported.report.unsupported.some((item) => item.field === "Project.LogWriterSettings"));
  t.deepEqual(importDizRaw(fixture), importDizRaw(fixture));
});

test("compressed .diz input is rejected", (t) => {
  t.throws(() => importDizRaw("not XML"), { message: /Compressed \.diz/ });
  t.throws(() => importDizRaw(fixture, { maximumMetadataBytes: 2 }), {
    message: /safety limit/,
  });
  t.throws(() => importDizRaw(fixture, { expectedRomSize: 4 }), {
    message: /ROM contains 4 content bytes/,
  });
});

test("local Secret of Mana .dizraw import is deterministic when the test-only file exists", (t) => {
  const file = path.resolve("Secret of Mana (USA).dizraw");
  if (!fs.existsSync(file)) {
    t.pass("local test-only fixture is not present");
    return;
  }
  const imported = importDizRaw(fs.readFileSync(file, "utf8"), { sourceName: path.basename(file) });
  t.is(imported.mapping.mapper, "hirom");
  t.is(imported.metadataBytes, 0x200000);
  t.is(imported.shards.labels.length, 287);
  t.is(imported.shards.regions.length, 150);
  t.is(
    canonicalJson(imported.report),
    canonicalJson(
      importDizRaw(fs.readFileSync(file, "utf8"), { sourceName: path.basename(file) }).report,
    ),
  );
});

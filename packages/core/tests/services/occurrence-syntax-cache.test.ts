import { spy } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { OccurrenceSyntaxCache } from "../../src/services/occurrence-syntax-cache.js";

test("syntax identities preserve separators, grammar and physical/generated occurrence boundaries", (t) => {
  const cache = new OccurrenceSyntaxCache<string>();
  const first = ["grammar:a", "file:1", 2, "physical", "x:y"] as const;
  cache.set(...first, "first");
  const variants = [
    ["grammar", "a:file:1", 2, "physical", "x:y"],
    ["grammar:a", "file:1", 3, "physical", "x:y"],
    ["grammar:a", "file:1", 2, "generated", "x:y"],
    ["grammar:a", "file:1", 2, "physical", "x\ny"],
  ] as const;
  for (const variant of variants) {
    t.is(cache.get(...variant), undefined);
  }
  t.is(cache.get(...first), "first");
  cache.clear();
  t.is(cache.get(...first), undefined);
});

test("complete source hits skip preprocessing while preserving source locations and invalidation", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const preprocess = spy(assembler.frontEndService, "preprocessSourcedBlockCommands");
  const source = "db 1 ; comment\ndb 2";
  const first = assembler.buildProgramModel(source, "one.asm", 4);
  t.is(assembler.buildProgramModel(source, "one.asm", 4).nodes, first.nodes);
  t.is(preprocess.callCount, 1);
  const moved = assembler.buildProgramModel(source, "two.asm", 8);
  t.not(moved.nodes, first.nodes);
  if ("source" in moved.nodes[0]) {
    t.is(moved.nodes[0].source.file, "two.asm");
    t.is(moved.nodes[0].source.line, 8);
  }
  t.not(assembler.frontEndService.parseGeneratedFragment(source, "one.asm", 4).nodes, first.nodes);
  assembler.passProgramCache.clear();
  t.not(assembler.buildProgramModel(source, "one.asm", 4).nodes, first.nodes);
  assembler.programModelBuilder.clearCache();
  t.is(assembler.passProgramCache.size, 0);
});

test("buffered structured statements bypass raw-source hits and do not poison complete-source syntax", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.setCurrentFile("stream.asm");
  const closing = "1 }";
  const plain = assembler.buildProgramModel(closing, "stream.asm");
  assembler.frontEndService.preprocessSourcedBlockCommands("dataStruct obj = { field =");
  t.true(assembler.frontEndService.commandBuffer.length > 0);
  const buffered = assembler.buildProgramModel(closing, "stream.asm");
  t.not(buffered.nodes, plain.nodes);
  const node = buffered.nodes[0];
  t.true("keyword" in node && node.keyword.toLowerCase() === "datastruct");
  t.is(assembler.frontEndService.commandBuffer, "");
  t.is(assembler.buildProgramModel(closing, "stream.asm").nodes, plain.nodes);
});

import { spy } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { AssemblyOutputBuffer } from "../../src/services/assembly-output-buffer.js";

test("large owned output exposes only written bytes across growth, patching and bulk fills", (t) => {
  const output = new AssemblyOutputBuffer();
  output.write(0, 0x123);
  output.fill(1, 0xab, 200000);
  t.true(output.bytes instanceof Uint8Array);
  t.is(output.bytes.length, 200001);
  t.is(output.bytes[0], 0x23);
  t.is(output.bytes[200000], 0xab);
  const first = output.bytes;
  output.write(7, 0x42);
  t.is(first[7], 0x42);
  output.write(400000, 0xcd);
  const grown = output.bytes;
  t.is(grown.length, 400001);
  t.is(grown[7], 0x42);
  t.is(grown[399999], 0);
  t.is(grown[400000], 0xcd);
  output.write(400001.5, 1);
  t.is(output.length, 400001);
});

test("assigned arrays retain identity and growth while assigned typed arrays stay fixed", (t) => {
  const output = new AssemblyOutputBuffer();
  const array = [1, 2];
  output.replace(array);
  output.fill(2, 3, 100000);
  t.is(output.bytes, array);
  t.is(array.length, 100002);
  const fixed = Uint8Array.of(4, 5);
  output.replace(fixed);
  output.write(100000, 9);
  output.fill(1, 7, 100000);
  t.is(output.bytes, fixed);
  t.deepEqual([...fixed], [4, 7]);
});

test("bulk seeding keeps the existing suffix and externally extended owned array extent", (t) => {
  const output = new AssemblyOutputBuffer();
  const initial = output.bytes;
  if (!Array.isArray(initial)) {
    t.fail();
    return;
  }
  initial.length = 1000000;
  initial[999999] = 8;
  output.seed(new Uint8Array(100000).fill(7));
  t.is(output.length, 1000000);
  t.is(output.bytes[99999], 7);
  t.is(output.bytes[200000], undefined);
  t.is(output.bytes[999999], 8);
  output.seed(Uint8Array.of(1, 2));
  t.is(output.bytes[0], 1);
  t.is(output.bytes[999999], 8);
});

test("owned dense and assigned array output preserve every hook, trace, gap, overwrite and mapping", (t) => {
  const results = [];
  for (const owned of [true, false]) {
    const assembler = new Assembler();
    t.teardown(() => assembler.dispose());
    if (!owned) {
      assembler.outputBytes = [];
    }
    assembler.outputFillByte = 0x5a;
    const trace: unknown[] = [];
    assembler.setTraceListener((event) => trace.push(event));
    const writes = spy(assembler, "beforeWrite");
    assembler.assembleSource(
      "lorom\norg $808000\ndw $1234\norg $828000\ndb 9\norg $808001\ndb 8",
      "output.asm",
    );
    const bytes = assembler.getBinaryOutput();
    t.is(bytes.length, 0x10001);
    t.is(bytes[0], 0x34);
    t.is(bytes[1], 8);
    t.is(bytes[2], 0x5a);
    t.is(bytes[0x10000], 9);
    results.push({
      bytes,
      trace,
      hooks: writes.args,
      mapping: assembler.addressToLineMapping,
      symbols: assembler.symbolDefinitions,
      references: assembler.symbolReferences,
    });
  }
  t.deepEqual(results[0], results[1]);
});

test("sparse raw patches preserve undefined reads for unwritten bytes and zero materialization", (t) => {
  for (const prefix of [0, 100000]) {
    const assembler = new Assembler();
    t.teardown(() => assembler.dispose());
    assembler.activateStage("emitProgram");
    assembler.expandOutput(prefix, 0x11);
    assembler.writeOutputBytes(prefix + 100000, 7);
    const hole = prefix + 1;
    t.is(assembler.read1(assembler.outputWriter.fromOutputOffset(hole)), undefined);
    const bytes = assembler.getBinaryOutput();
    t.is(bytes[hole], 0);
    t.is(bytes[prefix + 100000], 7);
  }
});

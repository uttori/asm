import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";
import { test } from "../../../tests/ava-helper.js";
import { ArchSPC700 } from "../src/architectures/spc700.js";

const createArchSPC700 = () => {
  const assembler = createEncoderTestHost();
  const arch = new ArchSPC700(assembler.context);
  return { assembler, arch };
};

test("ArchSPC700.estimateSize matches encoded widths for common forms", (t) => {
  const { arch } = createArchSPC700();
  t.is(arch.estimateSize([]), 0);
  t.is(arch.estimateSize(["CLRP"]), 1);
  t.is(arch.estimateSize(["MOV", "X,#$cf"]), 2);
  t.is(arch.estimateSize(["MOV", "SP,X"]), 1);
  t.is(arch.estimateSize(["MOV", "X,A"]), 1);
  t.is(arch.estimateSize(["BNE", "CODE_0407"]), 2);
  t.is(arch.estimateSize(["CALL", "CODE_0a96-MAPPING_OFFSET_2"]), 3);
  t.is(arch.estimateSize(["JMP", "CODE_0444-MAPPING_OFFSET_2"]), 3);
  t.is(arch.estimateSize(["MOV", "$0030+Y,A"]), 3);
  t.is(arch.estimateSize(["MOV", "$30+Y,A"]), 2);
  t.is(arch.estimateSize(["INC", "X"]), 1);
  t.is(arch.estimateSize(["SET5", "$48"]), 2);
  t.is(arch.estimateSize(["DBNZ", "Y,CODE_0446"]), 2);
  t.is(arch.estimateSize(["DBNZ", "$0c,CODE_070b"]), 3);
  t.is(arch.estimateSize(["CBNE", "$08+x,CODE_0502"]), 3);
  t.is(arch.estimateSize(["BBS7", "$4c,CODE_0462"]), 3);
  t.is(arch.estimateSize(["BBS", "$12.3,target"]), 3);
  t.is(arch.estimateSize(["NOT2", "C, $0027"]), 3);
  t.is(arch.estimateSize(["MOV2", "$0027, C"]), 3);
  t.is(arch.estimateSize(["MOV", "A,#$00"]), 2);
  t.is(arch.estimateSize(["CMP", "X,#$e0"]), 2);
});

test("ArchSPC700 encodes numbered mem.bit carry ops", (t) => {
  const { assembler, arch } = createArchSPC700();

  t.true(arch.encode(["NOT1", "$1234"]));
  t.true(arch.encode(["NOT2", "C, $0027"]));
  t.true(arch.encode(["NOT5", "C, $0028"]));
  t.true(arch.encode(["NOT3", "$12"]));
  t.true(arch.encode(["NOT1", "C,$12.3"]));
  t.true(arch.encode(["NOT1", "$12.3"]));
  t.true(arch.encode(["MOV1", "C, $0027"]));
  t.true(arch.encode(["MOV2", "$0027, C"]));
  t.true(arch.encode(["OR1", "C,$1234"]));
  t.true(arch.encode(["OR1", "C,!$1234"]));
  t.true(arch.encode(["AND1", "C,/$1234"]));
  t.true(arch.encode(["AND1", "C, $0027, 2"]));
  t.true(arch.encode(["EOR1", "C,$1234"]));

  t.deepEqual(
    assembler.emitted,
    [
      0xea, 0x34, 0x32, 0xea, 0x27, 0x40, 0xea, 0x28, 0xa0, 0xea, 0x12, 0x60, 0xea, 0x12, 0x60,
      0xea, 0x12, 0x60, 0xaa, 0x27, 0x20, 0xca, 0x27, 0x40, 0x0a, 0x34, 0x32, 0x2a, 0x34, 0x32,
      0x6a, 0x34, 0x32, 0x4a, 0x27, 0x40, 0x8a, 0x34, 0x32,
    ],
  );
});

test("ArchSPC700 encodes wiki BBS/BBC d.bit forms", (t) => {
  const { assembler, arch } = createArchSPC700();

  t.true(arch.encode(["BBS", "$12.3, target"]));
  t.true(arch.encode(["BBS3", "$12, target"]));
  t.true(arch.encode(["BBS1", "$12.3, target"]));
  t.true(arch.encode(["BBC", "$12.3, target"]));
  t.false(arch.encode(["BBS", "$12, target"]));

  t.deepEqual(
    assembler.emitted,
    [0x63, 0x12, 0xff, 0x63, 0x12, 0xff, 0x63, 0x12, 0xff, 0x73, 0x12, 0xff],
  );
});

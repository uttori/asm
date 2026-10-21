import { RomImage } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { analyzeSpc700Aram, materializeSpc700UploadBlock, parseSpc700UploadStream, SPC700_ARAM_ADDRESS_SPACE, SNES_FILE_ADDRESS_SPACE, spc700UploadProjectRecords } from "@uttori/asm-plugin-snes/disassembler";

const romFor = (bytes: readonly number[]): RomImage =>
  new RomImage(Uint8Array.from(bytes), { headerSize: 0 });

test("SPC700 upload parser models the assembler's multi-block NSPC stream", (t) => {
  const bytes = [
    0xa9,
    0xaa, // preceding 65816 instruction
    0x03,
    0x00,
    0x00,
    0x60,
    0x8f,
    0x44,
    0x33, // size 3, destination $6000
    0x06,
    0x00,
    0x00,
    0x50,
    0x5f,
    0x03,
    0x50,
    0x8f,
    0x22,
    0x11, // size 6, destination $5000
    0x00,
    0x00,
    0x00,
    0x50, // execute $5000
    0xa9,
    0xbb, // following 65816 instruction
  ];
  const rom = romFor(bytes);
  const stream = parseSpc700UploadStream(rom, 2);

  t.like(stream, {
    format: "nspc",
    startOffset: 2,
    endOffset: 23,
    terminatorOffset: 19,
    executeAddress: 0x5000,
  });
  t.deepEqual(stream.blocks, [
    {
      index: 0,
      headerOffset: 2,
      payloadOffset: 6,
      endOffset: 9,
      size: 3,
      destination: 0x6000,
      wraps: false,
    },
    {
      index: 1,
      headerOffset: 9,
      payloadOffset: 13,
      endOffset: 19,
      size: 6,
      destination: 0x5000,
      wraps: false,
    },
  ]);
  t.deepEqual(
    Array.from(rom.read(stream.startOffset, stream.endOffset - stream.startOffset)!),
    bytes.slice(2, 23),
  );

  const [segment] = materializeSpc700UploadBlock(rom, stream.blocks[1]);
  t.is(segment.image.loadAddress, 0x5000);
  t.deepEqual(Array.from(segment.image.bytes()), [0x5f, 0x03, 0x50, 0x8f, 0x22, 0x11]);
  t.deepEqual(
    analyzeSpc700Aram(segment.image, {
      entryPoints: [{ id: "execute", address: stream.executeAddress }],
    }).nodes.map((node) => [node.address, node.mnemonic]),
    [
      [0x5000, "JMP"],
      [0x5003, "MOV"],
    ],
  );
});

test("SPC700 wrapping uploads split into non-wrapping analyzable ARAM segments", (t) => {
  const rom = romFor([0x04, 0x00, 0xfe, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00, 0xfe, 0xff]);
  const stream = parseSpc700UploadStream(rom, 0);
  const segments = materializeSpc700UploadBlock(rom, stream.blocks[0]);

  t.true(stream.blocks[0].wraps);
  t.deepEqual(
    segments.map((segment) => ({
      index: segment.segmentIndex,
      source: [segment.sourceStart, segment.sourceEnd],
      address: segment.image.loadAddress,
      bytes: Array.from(segment.image.bytes()),
    })),
    [
      { index: 0, source: [4, 6], address: 0xfffe, bytes: [0x00, 0xff] },
      { index: 1, source: [6, 8], address: 0x0000, bytes: [0x00, 0xff] },
    ],
  );
});

test("SPC700 upload records preserve nested ROM and ARAM provenance without bytes", (t) => {
  const rom = romFor([0x02, 0x00, 0x00, 0x02, 0x00, 0xff, 0x00, 0x00, 0x00, 0x02]);
  const stream = parseSpc700UploadStream(rom, 0);
  const project = spc700UploadProjectRecords(rom, stream);
  const root = project.regions.find((region) => region.context === "snes.spc700.upload-stream")!;
  const block = project.regions.find((region) => region.context === "snes.spc700.upload-block")!;
  const payload = project.regions.find(
    (region) => region.context === "snes.spc700.upload-payload",
  )!;
  const aram = project.regions.find(
    (region) => region.context === "snes.spc700.upload-projection",
  )!;

  t.is(block.parentRegion, root.id);
  t.is(payload.parentRegion, block.id);
  t.is(aram.parentRegion, payload.id);
  t.is(root.addressSpace, SNES_FILE_ADDRESS_SPACE);
  t.is(aram.addressSpace, SPC700_ARAM_ADDRESS_SPACE);
  t.deepEqual(aram.attributes, {
    blockIndex: 0,
    loadOrder: 0,
    segmentIndex: 0,
    sourceAddressSpace: SNES_FILE_ADDRESS_SPACE,
    sourceStart: 4,
    sourceEnd: 6,
  });
  t.is(project.evidence[0].sourceId, "snes.spc700.nspc-v1");
  t.false(JSON.stringify(project).includes("byteData"));
});

test("SPC700 upload parser rejects truncation and deterministic-limit overruns", (t) => {
  t.throws(() => parseSpc700UploadStream(romFor([0x00]), 0), {
    message: /Truncated.*header/,
  });
  t.throws(() => parseSpc700UploadStream(romFor([0x02, 0, 0, 2, 0xff]), 0), {
    message: /Truncated.*payload/,
  });
  const twoBlocks = romFor([1, 0, 0, 2, 0xff, 1, 0, 1, 2, 0xff, 0, 0, 0, 2]);
  t.throws(() => parseSpc700UploadStream(twoBlocks, 0, { maxBlocks: 1 }), {
    message: /1-block parsing limit/,
  });
  t.throws(() => parseSpc700UploadStream(twoBlocks, 0, { maxBytes: 4 }), {
    message: /4-byte parsing limit/,
  });
  t.throws(() => parseSpc700UploadStream(twoBlocks, 0, { maxBlocks: 0 }), {
    message: /positive safe integer/,
  });
});

import { test } from "../../../tests/ava-helper.js";
import {
  CompressionCodecRegistry,
  reencodeCompressedRange,
  verifyCompressionCodec,
  type CompressionCodec,
} from "../src/index.js";

const rleCodec = (overrides: Partial<CompressionCodec> = {}): CompressionCodec => ({
  id: "fixture.game.rle",
  version: "1.0.0",
  decode: (encoded) => {
    const output: number[] = [];
    for (let index = 0; index < encoded.length; index += 2) {
      output.push(...Array.from({ length: encoded[index] }, () => encoded[index + 1]));
    }
    return Uint8Array.from(output);
  },
  encode: (decoded) => {
    const output: number[] = [];
    for (let index = 0; index < decoded.length;) {
      let end = index + 1;
      while (end < decoded.length && decoded[end] === decoded[index] && end - index < 0xff) end++;
      output.push(end - index, decoded[index]);
      index = end;
    }
    return Uint8Array.from(output);
  },
  ...overrides,
});

const constraints = (overrides = {}) => ({
  sourceOffset: 0x8100,
  originalSize: 6,
  maximumSize: 6,
  bankStart: 0x8000,
  bankEnd: 0x10000,
  ...overrides,
});

test("plugin compression codecs verify exact no-op and fixed-range edited output", (t) => {
  const registry = new CompressionCodecRegistry().register(rleCodec());
  const encoded = Uint8Array.from([3, 0x11, 2, 0x22, 1, 0x33]);
  const verified = verifyCompressionCodec(registry, "fixture.game.rle", encoded, constraints());
  t.is(verified.codecVersion, "1.0.0");
  t.is(verified.decodedSize, 6);

  const edited = reencodeCompressedRange(
    registry,
    "fixture.game.rle",
    Uint8Array.from([0x44, 0x44, 0x44, 0x44, 0x44, 0x44]),
    encoded,
    constraints({ fillByte: 0xff }),
  );
  t.deepEqual([...edited.encoded], [6, 0x44]);
  t.deepEqual([...edited.replacement], [6, 0x44, 0xff, 0xff, 0xff, 0xff]);
  t.is(edited.unusedSize, 4);
  t.deepEqual(
    registry.list().map((codec) => codec.id),
    ["fixture.game.rle"],
  );
});

test("compression registry rejects drift, overflow, bank crossing, and broken codecs", (t) => {
  const encoded = Uint8Array.from([3, 0x11, 2, 0x22, 1, 0x33]);
  const registry = new CompressionCodecRegistry().register(rleCodec());
  t.throws(
    () =>
      reencodeCompressedRange(
        registry,
        "fixture.game.rle",
        Uint8Array.from([1, 2, 3, 4]),
        encoded,
        constraints(),
      ),
    { message: /exceeding maximum/ },
  );
  t.throws(
    () =>
      verifyCompressionCodec(
        registry,
        "fixture.game.rle",
        encoded,
        constraints({ bankEnd: 0x8105 }),
      ),
    { message: /crosses its declared bank/ },
  );
  t.throws(
    () =>
      verifyCompressionCodec(
        registry,
        "fixture.game.rle",
        encoded,
        constraints({ originalSize: 5 }),
      ),
    { message: /must equal/ },
  );

  const lossy = new CompressionCodecRegistry().register(
    rleCodec({ id: "fixture.lossy", encode: () => Uint8Array.from([1, 0]) }),
  );
  t.throws(() => verifyCompressionCodec(lossy, "fixture.lossy", encoded, constraints()), {
    message: /decoded-data round-trip/,
  });
  const unstable = new CompressionCodecRegistry();
  let calls = 0;
  unstable.register(
    rleCodec({ id: "fixture.unstable", encode: () => Uint8Array.from([1, calls++]) }),
  );
  t.throws(() => verifyCompressionCodec(unstable, "fixture.unstable", encoded, constraints()), {
    message: /not deterministic/,
  });
  t.throws(() => registry.register(rleCodec()), { message: /Duplicate compression/ });
  t.throws(() => registry.resolve("missing"), { message: /Unknown compression/ });
});

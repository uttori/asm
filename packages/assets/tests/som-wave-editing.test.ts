import { test } from "../../../tests/ava-helper.js";
import { decodeBrrPcm, writePcmWave } from "../src/audio.js";
import {
  convertBrrWave,
  sliceBrrSegment,
  verifiedBrrFromWave,
} from "../src/secret-of-mana/som-asset-plugin.js";

/** Preserve original tokens in a normal playable WAVE with an optional private RIFF chunk. */
function fixture(native: Uint8Array, samples = decodeBrrPcm(native)) {
  const pcm = writePcmWave(samples, 32000);
  const bytes = new Uint8Array(pcm.length + 8 + native.length + (native.length & 1));
  bytes.set(pcm);
  bytes.set(new TextEncoder().encode("sBRR"), pcm.length);
  new DataView(bytes.buffer).setUint32(pcm.length + 4, native.length, true);
  bytes.set(native, pcm.length + 8);
  new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
  return { bytes, mediaType: "audio/wav" };
}

test("unchanged WAVE retains native tokens; edited PCM requires a deliberate loop policy", (t) => {
  const native = Uint8Array.of(0x11, 0x12, 0x34, 0x56, 0x70, 0, 0, 0, 0);
  const source = fixture(native);
  t.deepEqual(convertBrrWave(source).outputs.brr.bytes, native);
  t.deepEqual(verifiedBrrFromWave(source), native);
  const edited = decodeBrrPcm(native);
  edited[0] = 12000;
  const changed = fixture(native, edited);
  t.throws(() => convertBrrWave(changed), { message: /Declare loop/ });
  t.throws(() => verifiedBrrFromWave(changed), { message: /no longer matches/ });
  const output = convertBrrWave(changed, { loop: false }).outputs.brr;
  t.notDeepEqual(output.bytes, native);
  t.is(output.metadata?.nativePreserved, false);
  t.is(output.metadata?.fidelity, "lossy-audio");
  t.is(output.bytes.length, native.length);
  const decoded = decodeBrrPcm(output.bytes);
  const peak = Math.max(...edited.map((sample, index) => Math.abs(sample - decoded[index])));
  t.is(output.metadata?.peakError, peak);
  const stripped = { bytes: writePcmWave(edited, 32000), mediaType: "audio/wav" };
  t.deepEqual(convertBrrWave(stripped, { loop: false }).outputs.brr.bytes, output.bytes);
});

test("looped BRR exposes replay error and prevents a split stream from discarding a grown tail", (t) => {
  const native = new Uint8Array(18);
  native[9] = 3;
  const samples = new Int16Array(32);
  samples[0] = 4000;
  samples[16] = -4000;
  const source = fixture(native, samples);
  const options = { loop: { start: 16, end: 32 }, startByte: 4, byteLength: 14 };
  const output = convertBrrWave(source, options).outputs.brr;
  t.is(output.bytes[9] & 3, 3);
  t.is(output.metadata?.loopOffset, 9);
  t.is(typeof output.metadata?.loopPeakError, "number");
  t.is(decodeBrrPcm(output.bytes, 9, 1).length, 48);
  t.is(sliceBrrSegment(output.bytes, options).length, 14);
  const stripped = { bytes: writePcmWave(samples, 32000), mediaType: "audio/wav" };
  t.throws(() => convertBrrWave(stripped, options), { message: /fullByteLength/ });
  t.deepEqual(
    convertBrrWave(stripped, { ...options, fullByteLength: 18 }).outputs.brr.bytes,
    output.bytes,
  );
  const grown = fixture(native, new Int16Array(48));
  t.throws(() => convertBrrWave(grown, { ...options, loop: { start: 16, end: 48 } }), {
    message: /fullByteLength/,
  });
  t.throws(() => convertBrrWave(source, { loop: { start: 3, end: 32 } }), { message: /16-sample/ });
  t.throws(() => convertBrrWave(source, { loop: "source" }), { message: /no source loop/ });
});

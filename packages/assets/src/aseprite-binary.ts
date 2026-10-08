import { Inflate } from "pako";

import { ASSET_LIMITS, boundedSum } from "./limits.js";
import { integer } from "./validation.js";

const ATLAS_FILE_LIMIT = ASSET_LIMITS.asepriteBytes;
const decoder = new TextDecoder("utf-8", { fatal: true });

/** Bounded little-endian cursor; sub-cursors cannot read into the following chunk. */
export class Cursor {
  readonly view: DataView;
  /** Byte offset within this cursor's bounded payload. */
  position = 0;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  take(length: number): Uint8Array {
    integer(length, "Aseprite field size", 0, this.bytes.length - this.position);
    const value = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }
  u8(): number {
    return this.take(1)[0];
  }
  u16(): number {
    const offset = this.position;
    this.take(2);
    return this.view.getUint16(offset, true);
  }
  i16(): number {
    const offset = this.position;
    this.take(2);
    return this.view.getInt16(offset, true);
  }
  u32(): number {
    const offset = this.position;
    this.take(4);
    return this.view.getUint32(offset, true);
  }
  i32(): number {
    const offset = this.position;
    this.take(4);
    return this.view.getInt32(offset, true);
  }
  text(): string {
    return decoder.decode(this.take(this.u16()));
  }
  finish(): void {
    if (this.position !== this.bytes.length) {
      throw new Error("Unexpected Aseprite chunk payload.");
    }
  }
}

/** Small field builder borrowing parts until build; build returns owned bytes without variadic image calls. */
export class Fields {
  readonly parts: Uint8Array[] = [];
  /** Reserved bytes are checked while appending, before allocating the combined payload. */
  private length = 0;
  raw(bytes: Uint8Array): this {
    this.length = boundedSum(this.length, bytes.length, ATLAS_FILE_LIMIT, "Aseprite output size");
    this.parts.push(bytes);
    return this;
  }
  u8(value: number): this {
    return this.raw(Uint8Array.of(value));
  }
  u16(value: number): this {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return this.raw(bytes);
  }
  u32(value: number): this {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return this.raw(bytes);
  }
  text(value: string): this {
    const bytes = new TextEncoder().encode(value);
    integer(bytes.length, "Aseprite text size", 0, 65535);
    return this.u16(bytes.length).raw(bytes);
  }
  build(): Uint8Array {
    const bytes = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return bytes;
  }
}

/** Inflate incrementally; cancel as soon as the declared pixel count is exceeded. */
export async function rasterZlib(
  bytes: Uint8Array,
  expected: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  integer(expected, "Decoded payload", 0, ASSET_LIMITS.decodedBytes);
  signal?.throwIfAborted();
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("deflate")).getReader();
  const abort = (): void => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const output = new Uint8Array(expected);
  let offset = 0;
  try {
    for (;;) {
      const next = await reader.read();
      signal?.throwIfAborted();
      if (next.done) {
        break;
      }
      if (next.value.length > expected - offset) {
        throw new Error("Aseprite decompressed raster exceeds its declared bounds.");
      }
      output.set(next.value, offset);
      offset += next.value.length;
    }
    if (offset !== expected) {
      throw new Error("Aseprite decompressed raster length mismatch.");
    }
  } catch (cause) {
    await reader.cancel().catch(() => {});
    throw new Error("Invalid bounded Aseprite zlib raster.", { cause });
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  return output;
}

/** Emit one supported chunk; lengths include the six-byte chunk header. */
export function chunk(type: number, data: Uint8Array): Uint8Array {
  return new Fields()
    .u32(data.length + 6)
    .u16(type)
    .raw(data)
    .build();
}

/** Inflate into a fixed buffer. Streaming callbacks stop expansion before an oversized payload can accumulate. */
export function rasterZlibSync(bytes: Uint8Array, expected: number): Uint8Array {
  integer(expected, "Decoded payload", 0, ASSET_LIMITS.decodedBytes);
  const output = new Uint8Array(expected);
  let offset = 0;
  const inflator = new Inflate({ windowBits: 15, chunkSize: 16 * 1024 });
  let unread: (() => number) | undefined;
  // Pako permits unused bytes after a zlib member. The async Web Streams driver rejects them;
  // inspect its public start-hook stream so both parser drivers enforce one complete member.
  inflator.onStart = (stream): void => {
    unread = () => stream.avail_in;
  };
  inflator.onData = (part: Uint8Array): void => {
    if (part.length > expected - offset) {
      throw new Error("Aseprite decompressed raster exceeds its declared bounds.");
    }
    output.set(part, offset);
    offset += part.length;
  };
  let completed = false;
  inflator.onEnd = (status): void => {
    if (status !== 0) {
      throw new Error("Invalid Aseprite zlib stream.");
    }
    completed = true;
  };
  try {
    inflator.push(bytes, true);
    // Completion is set by Pako's callback; retain the explicit check even though TypeScript cannot follow that lifecycle.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!completed || offset !== expected || unread?.() !== 0) {
      throw new Error("Aseprite decompressed raster length or stream mismatch.");
    }
  } catch (cause) {
    throw new Error("Invalid bounded Aseprite zlib raster.", { cause });
  }
  return output;
}

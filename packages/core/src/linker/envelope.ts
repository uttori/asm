import { createHash, timingSafeEqual } from "node:crypto";

import { stableJson } from "./value.js";

const HEADER_SIZE = 52;
const MAX_METADATA = 16 * 1024 * 1024;
export const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;

/** A versioned binary envelope keeps payloads raw and hashes the header and every stored byte. */
export function encodeEnvelope(magic: string, metadata: unknown, payload: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(stableJson(metadata));
  if (
    json.length > MAX_METADATA ||
    payload.length > MAX_ARTIFACT_BYTES - HEADER_SIZE - json.length
  ) {
    throw new Error("Artifact exceeds its metadata or payload limit.");
  }
  const bytes = new Uint8Array(HEADER_SIZE + json.length + payload.length);
  bytes.set(new TextEncoder().encode(magic));
  const view = new DataView(bytes.buffer);
  view.setUint16(8, 1, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, payload.length, true);
  bytes.set(json, HEADER_SIZE);
  bytes.set(payload, HEADER_SIZE + json.length);
  bytes.set(digest(bytes), 20);
  return bytes;
}

/** Validate sizes before parsing JSON or exposing owned slices; trailing or corrupted data is rejected. */
export function decodeEnvelope(
  source: Uint8Array,
  magic: string,
): { metadata: unknown; payload: Uint8Array } {
  if (source.length < HEADER_SIZE || source.length > MAX_ARTIFACT_BYTES) {
    throw new Error("Truncated or oversized artifact.");
  }
  // Buffer.slice() borrows storage. Authenticate an owned snapshot so callers cannot
  // change bytes after validation, including when the backing memory is shared.
  const bytes = Uint8Array.from(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== magic) {
    throw new Error("Unsupported artifact magic.");
  }
  if (view.getUint16(8, true) !== 1 || view.getUint16(10, true) !== 0) {
    throw new Error("Unsupported artifact version or flags.");
  }
  const metadataSize = view.getUint32(12, true);
  const payloadSize = view.getUint32(16, true);
  if (metadataSize > MAX_METADATA || HEADER_SIZE + metadataSize + payloadSize !== bytes.length) {
    throw new Error("Artifact length mismatch.");
  }
  if (!timingSafeEqual(bytes.subarray(20, HEADER_SIZE), digest(bytes))) {
    throw new Error("Artifact SHA-256 mismatch.");
  }
  const metadata: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(HEADER_SIZE, HEADER_SIZE + metadataSize),
    ),
  );
  return { metadata, payload: bytes.slice(HEADER_SIZE + metadataSize) };
}

/** The digest slot is excluded so no mutable checksum field authenticates itself. */
function digest(bytes: Uint8Array): Uint8Array {
  return createHash("sha256")
    .update(bytes.subarray(0, 20))
    .update(bytes.subarray(HEADER_SIZE))
    .digest();
}

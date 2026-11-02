import type { AssemblyModule } from "../relocatable.js";
import { decodeEnvelope, encodeEnvelope } from "./envelope.js";
import { assertAssemblyModule } from "./validation.js";
import { integer, list, record, restoreValue } from "./value.js";

/** Bumps when on-disk object metadata layout is incompatible with prior readers. */
export const OBJECT_FORMAT_VERSION = 1;
const MAGIC = "UASMOBJ\0";

/** Write self-contained payloads and typed metadata; mutable asset paths never become external object storage. */
export function encodeObject(module: AssemblyModule): Uint8Array {
  assertAssemblyModule(module);
  let length = 0;
  const sections = module.sections.map(({ bytes, ...section }) => {
    const offset = length;
    length += bytes.length;
    return { ...section, payloadOffset: offset, payloadSize: bytes.length };
  });
  if (length > 128 * 1024 * 1024) {
    throw new Error("Object payload exceeds 128 MiB.");
  }
  const payload = new Uint8Array(length);
  module.sections.forEach((section, index) =>
    payload.set(section.bytes, sections[index].payloadOffset),
  );
  return encodeEnvelope(MAGIC, { ...module, sections }, payload);
}

/** Reader owns its result and checks canonical payload extents before exposing a module to the linker. */
export function decodeObject(bytes: Uint8Array): AssemblyModule {
  const { metadata, payload } = decodeEnvelope(bytes, MAGIC);
  const module = record(restoreValue(metadata), "Object metadata");
  let consumed = 0;
  module.sections = list(module.sections, "Sections").map((item) => {
    const section = record(item, "Section");
    const { payloadOffset, payloadSize, ...fields } = section;
    const start = integer(payloadOffset, "Payload offset", 0, payload.length);
    const size = integer(payloadSize, "Payload size", 0, payload.length - start);
    if (start !== consumed) {
      throw new Error("Noncanonical or overlapping section payloads.");
    }
    consumed += size;
    return Object.assign(fields, { bytes: payload.slice(start, start + size) });
  });
  if (consumed !== payload.length) {
    throw new Error("Unowned object payload bytes.");
  }
  assertAssemblyModule(module);
  return module;
}

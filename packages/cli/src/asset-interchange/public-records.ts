import type { InterchangeCapabilities } from "@uttori/asm-assets/interchange";
import { ASSET_LIMITS } from "@uttori/asm-assets/limits";
import { assertSourcePath } from "@uttori/asm-disassembler";

import type { AssetExportManifest, AssetImportReview } from "./contracts.js";

// Public metadata validation has no dependency on Node conversion/orchestration, so editor UI bundles can load it safely.
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("Invalid asset record object.");
  }
  return value;
}
export function text(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 4096) {
    throw new Error("Invalid asset record text.");
  }
  return value;
}
export function digest(value: unknown): string {
  const result = text(value);
  if (!/^[\da-f]{64}$/.test(result)) {
    throw new Error("Invalid asset record hash.");
  }
  return result;
}
export function locator(value: unknown): string {
  const result = text(value);
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(result)) {
    throw new Error("Invalid asset export locator.");
  }
  return result;
}
export function number(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error("Invalid asset record integer.");
  }
  return value;
}
export function strings(value: unknown, maximum = 65536): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error("Invalid asset string inventory.");
  }
  return value.map(text);
}
export function bytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length > ASSET_LIMITS.decodedBytes) {
    throw new Error("Invalid asset record bytes.");
  }
  return value;
}
export function capabilities(value: unknown): InterchangeCapabilities {
  const input = object(value);
  if (
    typeof input.pixelEdits !== "boolean" ||
    typeof input.paletteEdits !== "boolean" ||
    typeof input.tileReferences !== "boolean" ||
    typeof input.previewTimeline !== "boolean"
  ) {
    throw new Error("Invalid asset capabilities.");
  }
  return {
    pixelEdits: input.pixelEdits,
    paletteEdits: input.paletteEdits,
    tileReferences: input.tileReferences,
    previewTimeline: input.previewTimeline,
  };
}
function contract(value: unknown): { readonly id: string; readonly version: number } {
  const input = object(value);
  return { id: text(input.id), version: number(input.version, 65535) };
}
/** Manifest metadata selects a private record; it cannot grant paths, mappings or capabilities. */
export function readAssetExportManifest(value: unknown): AssetExportManifest {
  const input = object(value);
  if (input.format !== "uttori-asset-export" || input.version !== 2) {
    throw new Error("Unsupported asset manifest; re-export is required.");
  }
  return {
    format: input.format,
    version: input.version,
    id: locator(input.id),
    project: text(input.project),
    asset: text(input.asset),
    adapter: contract(input.adapter),
    codec: contract(input.codec),
    capabilities: capabilities(input.capabilities),
  };
}

/** Validate a bounded public review received over IPC; only the private persisted plan can authorize application. */
export function readAssetImportReview(value: unknown): AssetImportReview {
  const input = object(value);
  if (
    input.format !== "uttori-asset-review" ||
    input.version !== 2 ||
    !Array.isArray(input.files) ||
    input.files.length > 65536 ||
    !Array.isArray(input.effects) ||
    input.effects.length > 65536
  ) {
    throw new Error("Unsupported asset review summary.");
  }
  const files = input.files.map((entry) => {
      const file = object(entry),
        name = text(file.path);
      assertSourcePath(name);
      return { path: name, before: digest(file.before), after: digest(file.after) };
    }),
    effects = input.effects.map((entry) => {
      const effect = object(entry);
      return {
        resource: text(effect.resource),
        offset: number(effect.offset, Number.MAX_SAFE_INTEGER),
        size: number(effect.size, ASSET_LIMITS.decodedBytes),
        consumers: strings(effect.consumers, 65536),
      };
    });
  return immutableReview({
    format: input.format,
    version: input.version,
    id: digest(input.id),
    exportId: locator(input.exportId),
    documentSha256: digest(input.documentSha256),
    outputSha256: digest(input.outputSha256),
    files,
    effects,
  });
}

/** Freeze the complete review summary, including consumer lists, before returning it to a host. */
export function immutableReview(value: AssetImportReview): AssetImportReview {
  return Object.freeze({
    ...value,
    files: Object.freeze(value.files.map((item) => Object.freeze({ ...item }))),
    effects: Object.freeze(
      value.effects.map((item) =>
        Object.freeze({ ...item, consumers: Object.freeze([...item.consumers]) }),
      ),
    ),
  });
}

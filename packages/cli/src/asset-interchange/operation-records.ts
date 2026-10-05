import { ASSET_LIMITS } from "@uttori/asm-assets/limits";

import type { AssetSourceDraft } from "./contracts.js";
import { number, object, text } from "./public-records.js";

/** Small serializable file operations; image payloads and source replacement bytes stay inside the worker. */
export type AssetFileOperation = {
  readonly directory: string;
  readonly document: string;
  readonly manifest: string;
  /** Dirty drafts captured by the editor before starting; a live publication gate supplements this snapshot. */
  readonly drafts?: readonly AssetSourceDraft[];
} & (
  | {
      readonly action: "asset-export";
      readonly adapter: string;
      readonly selection: string;
      readonly presentation?: "tilemap" | "raster" | "indexed-png";
    }
  | { readonly action: "asset-review" }
  | { readonly action: "asset-apply"; readonly review: string }
);

/** Maintenance moves only trusted journal bytes or explicitly reviewed private records. */
export type AssetMaintenanceOperation =
  | {
      readonly action: "asset-recover";
      readonly directory: string;
      readonly direction: "before" | "after";
      readonly drafts?: readonly AssetSourceDraft[];
    }
  | {
      readonly action: "asset-cleanup";
      readonly directory: string;
      readonly policy: string;
      readonly review?: string;
    };
export type AssetOperation = AssetFileOperation | AssetMaintenanceOperation;

/** Validate the lightweight IPC boundary before worker file reads; paths and draft metadata have separate bounded work. */
export function readAssetOperation(value: unknown): AssetOperation {
  const input = object(value),
    directory = text(input.directory);
  let drafts: AssetSourceDraft[] | undefined;
  if (input.drafts !== undefined) {
    if (!Array.isArray(input.drafts) || input.drafts.length > 65536) {
      throw new Error("Invalid asset draft inventory.");
    }
    let pathBytes = 0;
    drafts = input.drafts.map((value) => {
      const draft = object(value),
        file = text(draft.path);
      pathBytes += new TextEncoder().encode(file).length;
      if (pathBytes > ASSET_LIMITS.metadataBytes || typeof draft.opaque !== "boolean") {
        throw new Error("Invalid asset draft metadata.");
      }
      return {
        path: file,
        version: number(draft.version, Number.MAX_SAFE_INTEGER),
        opaque: draft.opaque,
      };
    });
  }
  if (input.action === "asset-recover") {
    if (input.direction !== "before" && input.direction !== "after") {
      throw new Error("Expected before or after recovery direction.");
    }
    return { action: input.action, directory, direction: input.direction, drafts };
  }
  if (input.action === "asset-cleanup") {
    return {
      action: input.action,
      directory,
      policy: text(input.policy),
      review: input.review === undefined ? undefined : text(input.review),
    };
  }
  const common = {
    directory,
    document: text(input.document),
    manifest: text(input.manifest),
    drafts,
  };
  if (input.action === "asset-review") {
    return { ...common, action: input.action };
  }
  if (input.action === "asset-apply") {
    return { ...common, action: input.action, review: text(input.review) };
  }
  if (input.action === "asset-export") {
    const presentation = input.presentation;
    if (
      presentation !== undefined &&
      presentation !== "tilemap" &&
      presentation !== "raster" &&
      presentation !== "indexed-png"
    ) {
      throw new Error("Unsupported asset presentation.");
    }
    return {
      ...common,
      action: input.action,
      selection: text(input.selection),
      adapter: text(input.adapter),
      presentation,
    };
  }
  throw new Error("Unsupported asset operation.");
}

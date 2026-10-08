import { ASSET_LIMITS } from "./limits.js";

/** Portable authoring authority. Adapter-specific mappings stay in declared resources, never private editor sessions. */
export interface AssetSourceBinding {
  readonly format: "uttori-asset-source";
  readonly version: 1;
  /** Stable opaque asset identity, also embedded by codecs that support it. */
  readonly id: string;
  readonly adapter: string;
  readonly source: { readonly path: string; readonly representation: string };
  /** Paths resolve relative to this binding. Reference data stays fixed across representation switches. */
  readonly resources: Readonly<Record<string, string>>;
  /** Native declarations retain their segment identities, options and codec independently of source representation. */
  readonly native: readonly {
    readonly format: string;
    readonly options: Readonly<Record<string, unknown>>;
  }[];
}

/** Portable relative paths may reach adjacent source directories but cannot invoke platform/URL resolution. */
export function sourceResourcePath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 1024 ||
    /[\0:\\]/.test(value) ||
    value.startsWith("/")
  ) {
    throw new Error("Source binding requires a portable relative resource path.");
  }
  return value;
}

/** Validate an envelope before any resource is resolved; game adapters validate mapping semantics. */
function isSourceBinding(value: unknown): value is AssetSourceBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid asset source binding.");
  }
  const binding = value as Partial<AssetSourceBinding>;
  if (
    binding.format !== "uttori-asset-source" ||
    binding.version !== 1 ||
    typeof binding.id !== "string" ||
    !/^[\da-f-]{36}$/.test(binding.id) ||
    typeof binding.adapter !== "string" ||
    !binding.adapter ||
    !binding.source ||
    typeof binding.source.representation !== "string" ||
    !binding.resources ||
    typeof binding.resources !== "object" ||
    Array.isArray(binding.resources) ||
    !Array.isArray(binding.native) ||
    !binding.native.length ||
    binding.native.length > 1024
  ) {
    throw new Error("Unsupported or incomplete asset source binding.");
  }
  sourceResourcePath(binding.source.path);
  for (const resource of Object.values(binding.resources)) {
    sourceResourcePath(resource);
  }
  const declarations: readonly unknown[] = binding.native;
  for (const declaration of declarations) {
    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
      throw new Error("Invalid native declaration in asset source binding.");
    }
    const native: Record<string, unknown> = Object.fromEntries(Object.entries(declaration));
    if (
      typeof native.format !== "string" ||
      !native.format ||
      !native.options ||
      typeof native.options !== "object" ||
      Array.isArray(native.options)
    ) {
      throw new Error("Invalid native declaration in asset source binding.");
    }
  }
  return true;
}

/** Bounded portable source metadata is validated before callers can discover its resources. */
export function readAssetSourceBinding(bytes: Uint8Array): AssetSourceBinding {
  if (bytes.length > ASSET_LIMITS.metadataBytes) {
    throw new Error("Asset source binding exceeds its metadata budget.");
  }
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!isSourceBinding(value)) {
    throw new Error("Invalid asset source binding.");
  }
  return value;
}

/** Keys include the declaring binding identity, so sibling sidecars with equal relative filenames cannot collide. */
export function bindingResourceKey(binding: string, resource: string): string {
  return `${binding}#${resource}`;
}

/** Incremental source-resource request, structurally compatible with assembler discovery without a runtime dependency. */
export interface SourceResourceDependency {
  readonly key: string;
  readonly path: string;
  readonly relativeTo?: string;
  readonly mediaType?: string;
}

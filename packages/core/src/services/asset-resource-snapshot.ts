import type {
  AssetFormatContribution,
  AssetResourceDependency,
  AssetSource,
} from "../plugin/contracts.js";

/** Hosts choose resolution scope and impose their own read/byte budgets; snapshots remain borrowed here. */
export interface AssetResourceSnapshotHost {
  /** Resolve in the assembly context, or relative to an already resolved declaring resource. */
  resolve(path: string, declaringResource?: string): string | undefined;
  /** Borrow a stable snapshot for this path; the host owns copying, lifetime and read limits. */
  read(path: string): Uint8Array;
  /** Returns the MIME type used when building asset source metadata for a path. */
  mediaType(path: string): string;
}

/** Infer representation hints from registered suffixes before applying legacy resource defaults. */
export function assetSourceMediaType(
  path: string,
  format?: Readonly<AssetFormatContribution>,
): string {
  const representation = format?.sourceRepresentations?.find((item) =>
    item.extensions.some((extension) => path.toLowerCase().endsWith(extension)),
  );
  if (representation) {
    return representation.mediaType;
  }
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "aseprite" || extension === "ase") {
    return "image/x-aseprite";
  }
  if (extension === "wav" || extension === "wave") {
    return "audio/wav";
  }
  if (extension === "json") {
    return "application/json";
  }
  return "application/octet-stream";
}

/** Narrows JSON fields expected to be non-empty strings. */
function isName(value: unknown): value is string {
  return typeof value === "string" && !!value;
}

/** Narrows unknown JSON values to arrays for dependency validation. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Plain JavaScript providers receive the same validation as typed plugins before path resolution. */
function isDependency(value: unknown): value is AssetResourceDependency {
  return (
    !!value &&
    typeof value === "object" &&
    "key" in value &&
    isName(value.key) &&
    "path" in value &&
    isName(value.path) &&
    (!("relativeTo" in value) || value.relativeTo === undefined || isName(value.relativeTo)) &&
    (!("mediaType" in value) || value.mediaType === undefined || isName(value.mediaType))
  );
}

/**
 * A synchronous, bounded closure shared by assembly, dependency discovery and explicit editor previews.
 * Each callback gets owned byte/option copies. Paths are read once through the host snapshot; keys
 * can alias bytes but may not change identity or form recursive relative-resource declarations.
 */
export function resolveAssetResourceSnapshot(
  format: Readonly<AssetFormatContribution>,
  source: AssetSource,
  options: Readonly<Record<string, unknown>>,
  host: AssetResourceSnapshotHost,
): { resources: Record<string, AssetSource>; paths: Record<string, string> } {
  const resources: Record<string, AssetSource> = {};
  const paths: Record<string, string> = {};
  // Provider keys can contain __proto__; resource dictionaries must have no inherited setters.
  Object.setPrototypeOf(resources, null);
  Object.setPrototypeOf(paths, null);
  const parents = new Map<string, string | undefined>();
  const declared: unknown = format.resourcePaths?.(structuredClone(options)) ?? [];
  if (!isUnknownArray(declared) || !declared.every(isName)) {
    throw new Error(`Asset format '${format.id}' returned invalid resource paths.`);
  }
  for (let depth = 0; depth < 32; depth++) {
    const dynamic: unknown =
      format.resourceDependencies?.(
        { ...source, bytes: source.bytes.slice() },
        structuredClone(options),
        Object.fromEntries(
          Object.entries(resources).map(([key, value]) => [
            key,
            { ...value, bytes: value.bytes.slice() },
          ]),
        ),
      ) ?? [];
    if (!isUnknownArray(dynamic) || !dynamic.every(isDependency)) {
      throw new Error(`Asset format '${format.id}' returned invalid resource dependencies.`);
    }
    if (declared.length + dynamic.length > 1024) {
      throw new Error(`Asset format '${format.id}' exceeds the resource closure limit.`);
    }
    const requests = [
      ...declared.map((path) => ({ key: path, path, relativeTo: undefined, mediaType: undefined })),
      ...dynamic,
    ];
    let added = false;
    for (const request of requests) {
      let parent: string | undefined;
      if (request.relativeTo !== undefined) {
        parent = paths[request.relativeTo];
        if (!parent) {
          throw new Error(`Resource '${request.key}' has an undiscovered relativeTo key.`);
        }
      }
      const resolved = host.resolve(request.path, parent);
      if (!resolved) {
        throw new Error(`Resource '${request.key}' cannot find '${request.path}'.`);
      }
      // Aliases are permitted, but following a binding back to an ancestor would hide a recursive source dependency.
      for (let ancestor = request.relativeTo; ancestor; ancestor = parents.get(ancestor)) {
        if (paths[ancestor] === resolved) {
          throw new Error(`Resource dependency cycle at '${request.key}'.`);
        }
      }
      const mediaType = request.mediaType ?? host.mediaType(resolved);
      if (Object.hasOwn(paths, request.key)) {
        if (
          paths[request.key] !== resolved ||
          parents.get(request.key) !== request.relativeTo ||
          resources[request.key].mediaType !== mediaType
        ) {
          throw new Error(`Conflicting resource identity '${request.key}'.`);
        }
        continue;
      }
      if (Object.keys(paths).length >= 1024) {
        throw new Error(`Asset format '${format.id}' exceeds the resource closure limit.`);
      }
      paths[request.key] = resolved;
      parents.set(request.key, request.relativeTo);
      resources[request.key] = { bytes: host.read(resolved), mediaType };
      added = true;
    }
    if (!added) {
      return { resources, paths };
    }
  }
  throw new Error(`Asset format '${format.id}' exceeds the resource discovery depth limit.`);
}

import { indexedAtlasDocument, inspectAtlasChanges } from "../atlas-interchange.js";
import type { IndexedDocument } from "../indexed-document.js";
import { inspectTilemapInterchange, type InterchangeChanges } from "../interchange.js";
import { pngImporter } from "../png.js";
import type { AssetInput } from "../registry.js";
import {
  bindingResourceKey,
  readAssetSourceBinding,
  type SourceResourceDependency,
} from "../source-binding.js";
import { indexedSourceCodecs, type AssetSourceCodecRegistry } from "../source-codecs.js";
import { createSomAtlasExport, planSomAtlasImport } from "./som-atlas-interchange.js";
import { bindFrameAtlasPalette, readFrameLayout } from "./som-frame-atlas.js";
import { planSpritePaletteWords } from "./som-palette-edit.js";
import { createSomSpriteInterchange } from "./som-sprite-interchange.js";
import {
  parseSpritePaletteCatalog,
  spritePaletteColors,
  type SpritePaletteCatalog,
} from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";

/** Validate authoring resource names before they enter the dependency closure. */
function isSourceNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((name: unknown) => typeof name === "string" && !!name);
}

/** Binding dependencies are explicit on graphics and palette includes, making reconciliation independent of build order. */
function bindingNames(options: Readonly<Record<string, unknown>>): string[] {
  const result: string[] = [];
  if (options.sourceBinding !== undefined) {
    if (typeof options.sourceBinding !== "string" || !options.sourceBinding) {
      throw new Error("sourceBinding must name an authoring sidecar.");
    }
    result.push(options.sourceBinding);
  }
  if (options.paletteSources !== undefined) {
    if (!isSourceNames(options.paletteSources)) {
      throw new Error("paletteSources must be an array of authoring sidecar paths.");
    }
    result.push(...options.paletteSources);
  }
  return [...new Set(result)];
}

/** Discover adjacent reference/mapping resources from validated source bindings. No game state is mutated. */
export function somSourceDependencies(
  _source: AssetInput,
  options: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>>,
  codecs = indexedSourceCodecs(),
): readonly SourceResourceDependency[] {
  return bindingNames(options).flatMap((name) => {
    const requests: SourceResourceDependency[] = [{ key: name, path: name }];
    if (!Object.hasOwn(resources, name)) {
      return requests;
    }
    const binding = readAssetSourceBinding(resources[name].bytes);
    for (const [key, path] of Object.entries(binding.resources)) {
      requests.push({ key: bindingResourceKey(name, key), path, relativeTo: name });
    }
    // The owning include already supplies its source. Palette outputs and other consumers need it explicitly.
    if (name !== options.sourceBinding) {
      requests.push({
        key: bindingResourceKey(name, "source"),
        path: binding.source.path,
        relativeTo: name,
        mediaType: codecs.get(binding.source.representation).mediaType,
      });
    }
    return requests;
  });
}

/** Require exact resource keys rather than inherited object properties or guessed filenames. */
function input(resources: Readonly<Record<string, AssetInput>>, key: string): AssetInput {
  if (!Object.hasOwn(resources, key)) {
    throw new Error(`Missing authoring resource '${key}'.`);
  }
  return resources[key];
}

/** Palette-only views follow the existing canvas/guide slots, retaining variant colors without allocating native pixels. */
export function somPngPaletteViews(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog) {
  const raster = createSomAtlasExport(atlas, catalog, atlas.id);
  const primarySlots = atlas.layout.paletteRefs.flatMap((palette) =>
    Array.from({ length: 16 }, (_, index) => ({ palette, index })),
  );
  const slots: ({ palette: string; index: number } | null)[] = [...primarySlots];
  while (slots.length < raster.document.palette.length) {
    slots.push(null);
  }
  const palette = [...raster.document.palette];
  const editable = [...raster.policy.editablePaletteSlots];
  const variants = [
    ...new Set((atlas.layout.paletteVariants ?? []).map((variant) => variant.palette)),
  ].filter((id) => !atlas.layout.paletteRefs.includes(id));
  for (const id of variants) {
    const first = palette.length;
    palette.push(...spritePaletteColors(catalog, id));
    const record = catalog.palettes[id];
    for (let index = 0; index < 16; index++) {
      slots.push({ palette: id, index });
      // Transparent words carry hidden native bits and remain immutable even in unused palette-only views.
      if (
        index > 0 &&
        index >= record.firstIndex &&
        index < record.firstIndex + record.words.length
      ) {
        editable.push(first + index);
      }
    }
  }
  if (palette.length > 256) {
    throw new Error(
      "PNG source requires more than 256 declared palette slots; choose a representation with sufficient palette capacity.",
    );
  }
  return {
    document: { ...raster.document, palette },
    policy: { ...raster.policy, editablePaletteSlots: editable },
    slots,
  };
}

/** Snapshot of one complete native inventory and its editor deltas; reference files never change during build. */
function inspectBoundSourceUncached(
  name: string,
  source: AssetInput,
  resources: Readonly<Record<string, AssetInput>>,
  codecs: AssetSourceCodecRegistry<IndexedDocument>,
) {
  const binding = readAssetSourceBinding(input(resources, name).bytes);
  if (binding.adapter !== "som.sprite.native") {
    throw new Error(`Unsupported source adapter '${binding.adapter}'.`);
  }
  const reference = input(resources, bindingResourceKey(name, "reference"));
  const layoutInput = input(resources, bindingResourceKey(name, "layout"));
  const catalog = parseSpritePaletteCatalog(
    input(resources, bindingResourceKey(name, "palettes")).bytes,
  );
  const layout = readFrameLayout({ layout: "layout.json" }, { "layout.json": layoutInput });
  const nativeOptions = Object.fromEntries(
    binding.native.flatMap((entry) => {
      if (entry.format !== "som.boss.graphics") {
        return [];
      }
      const segment = entry.options.segment;
      if (typeof segment !== "string" || !Object.hasOwn(layout.segments, segment)) {
        throw new Error("Source binding has an unknown native segment.");
      }
      return [[segment, entry.options]];
    }),
  );
  const nativeResources: Record<string, AssetInput> = {};
  for (const entry of binding.native) {
    if (
      typeof entry.options.native === "string" &&
      Object.hasOwn(binding.resources, entry.options.native)
    ) {
      nativeResources[entry.options.native] = input(
        resources,
        bindingResourceKey(name, entry.options.native),
      );
    }
  }
  const atlas: SpriteAtlasSource = {
    id: binding.id,
    source: reference,
    layout,
    nativeOptions,
    resources: nativeResources,
  };
  const presentation = createSomSpriteInterchange(atlas, catalog, binding.id);
  const codec = codecs.identify(source.bytes, { mediaType: source.mediaType });
  if (codec.id !== binding.source.representation) {
    throw new Error(`Source ${binding.source.path}: representation disagrees with its binding.`);
  }
  const document = codec.decode(source.bytes, presentation.baseline.document);
  let changes: InterchangeChanges;
  let slots: readonly ({ palette: string; index: number } | null)[] = presentation.paletteSlots;
  if (document.tilesets.length) {
    changes = inspectTilemapInterchange(presentation.baseline, document);
  } else {
    const raster = somPngPaletteViews(atlas, catalog);
    const image = indexedAtlasDocument(pngImporter.import(source).value, 0);
    if (codec.id !== "indexed-png") {
      throw new Error("Sprite authoring requires its complete identified tilemap inventory.");
    }
    const owned = new Uint8Array(image.indexes.length);
    for (const owner of raster.policy.owners) {
      for (let y = 0; y < owner.height; y++) {
        owned.fill(
          1,
          (owner.y + y) * image.width + owner.x,
          (owner.y + y) * image.width + owner.x + owner.width,
        );
      }
    }
    // Saved PNGs can retain old derived poses or the canonical refreshed poses. Only native rectangles vote on pixel ownership.
    const nativeIndexes = image.indexes.map((slot, index) =>
      owned[index] ? slot : raster.document.indexes[index],
    );
    changes = inspectAtlasChanges(
      raster.document,
      { ...image, indexes: nativeIndexes, exportId: binding.id },
      raster.policy,
    );
    const canonical = planSomAtlasImport(atlas, catalog, { pixels: changes.pixels, colors: [] });
    const expected = indexedAtlasDocument(
      pngImporter.import({ bytes: canonical.png, mediaType: "image/png" }).value,
      0,
    );
    if (
      image.indexes.some(
        (slot, index) =>
          !owned[index] &&
          slot !== raster.document.indexes[index] &&
          slot !== expected.indexes[index],
      )
    ) {
      throw new Error(
        "Read-only PNG guides or composition pixels changed outside native ownership.",
      );
    }
    slots = raster.slots;
  }
  return { binding, atlas, catalog, changes, slots };
}

/**
 * Pure reconciliations are reused across palette/graphics declarations only when every authoritative byte agrees.
 * The registry scopes codec semantics and cache lifetime; four bounded entries retain at most 32 MiB of input snapshots.
 */
const inspectionCaches = new WeakMap<
  AssetSourceCodecRegistry<IndexedDocument>,
  {
    snapshots: readonly Uint8Array[];
    mediaType: string;
    revision: number;
    value: ReturnType<typeof inspectBoundSourceUncached>;
  }[]
>();

/** Owned byte comparisons avoid hash collisions and never turn a changed sidecar/source into a stale build result. */
function inspectBoundSource(
  name: string,
  source: AssetInput,
  resources: Readonly<Record<string, AssetInput>>,
  codecs: AssetSourceCodecRegistry<IndexedDocument>,
) {
  const bindingBytes = input(resources, name).bytes;
  const binding = readAssetSourceBinding(bindingBytes);
  const snapshots = [
    bindingBytes,
    source.bytes,
    ...Object.keys(binding.resources)
      .toSorted()
      .map((key) => input(resources, bindingResourceKey(name, key)).bytes),
  ];
  const cache = inspectionCaches.get(codecs) ?? [];
  const found = cache.find(
    (entry) =>
      entry.revision === codecs.revision &&
      entry.mediaType === source.mediaType &&
      entry.snapshots.length === snapshots.length &&
      entry.snapshots.every(
        (before, index) =>
          before.length === snapshots[index].length &&
          before.every((byte, offset) => byte === snapshots[index][offset]),
      ),
  );
  if (found) {
    return found.value;
  }
  let value: ReturnType<typeof inspectBoundSourceUncached>;
  try {
    value = inspectBoundSourceUncached(name, source, resources, codecs);
  } catch (error) {
    throw new Error(
      `Source '${binding.source.path}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const bytes = snapshots.reduce((total, item) => total + item.length, 0);
  // Large documents still obey decoder budgets, but do not receive a second long-lived cache allocation.
  if (bytes <= 8 * 1024 * 1024) {
    cache.unshift({
      snapshots: snapshots.map((item) => item.slice()),
      mediaType: source.mediaType,
      revision: codecs.revision,
      value,
    });
    cache.splice(4);
    inspectionCaches.set(codecs, cache);
  }
  return value;
}

/** Changed palette aliases vote by physical ROM word. Unchanged views retain the reference and never veto an edit. */
export function effectiveSomSourcePalette(
  catalog: SpritePaletteCatalog,
  options: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>>,
  ownSource?: AssetInput,
  codecs = indexedSourceCodecs(),
): SpritePaletteCatalog {
  const edits = new Map<number, { palette: string; index: number; rgb: number[] }>();
  for (const name of bindingNames(options)) {
    let source: AssetInput;
    if (name === options.sourceBinding && ownSource) {
      source = ownSource;
    } else {
      source = input(resources, bindingResourceKey(name, "source"));
    }
    const inspected = inspectBoundSource(name, source, resources, codecs);
    for (const change of inspected.changes.colors) {
      const slot = inspected.slots[change.index];
      if (!slot) {
        throw new Error(
          `Source ${inspected.binding.source.path}: read-only palette guide changed.`,
        );
      }
      if (!Object.hasOwn(catalog.palettes, slot.palette)) {
        throw new Error(`Source ${inspected.binding.id}: missing palette owner ${slot.palette}.`);
      }
      const record = catalog.palettes[slot.palette];
      const address = Number.parseInt(record.romAddress, 16) + (slot.index - record.firstIndex) * 2;
      const rgb = change.color.slice(0, 3);
      const previous = edits.get(address);
      if (previous && previous.rgb.some((channel, index) => channel !== rgb[index])) {
        throw new Error(
          `Conflicting authored palette values at $${address.toString(16)} (${slot.palette}:${slot.index}).`,
        );
      }
      edits.set(address, { ...slot, rgb });
    }
  }
  return planSpritePaletteWords(catalog, [...edits.values()]).catalog;
}

/** Reconstruct the canonical PNG from native owner changes, retaining guides, composition and original compressed chunks. */
export function normalizeSomSource(
  source: AssetInput,
  options: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>>,
  catalog: SpritePaletteCatalog,
  codecs = indexedSourceCodecs(),
) {
  const effective = effectiveSomSourcePalette(catalog, options, resources, source, codecs);
  if (typeof options.sourceBinding !== "string") {
    if (source.mediaType !== "image/png") {
      throw new Error(
        "Composed sprite sources require an explicit sourceBinding created by source conversion.",
      );
    }
    const layout = bindFrameAtlasPalette(source, readFrameLayout(options, resources), catalog);
    return { source, layout, catalog: effective };
  }
  const inspected = inspectBoundSource(options.sourceBinding, source, resources, codecs);
  const reconstructed = planSomAtlasImport(inspected.atlas, inspected.catalog, {
    pixels: inspected.changes.pixels,
    colors: [],
  });
  // Palette-only edits leave the reference PNG unchanged. Bind those stored indexes to their immutable
  // reference colors before passing the effective display/catalog colors to the native encoder.
  const layout = bindFrameAtlasPalette(
    inspected.atlas.source,
    reconstructed.layout,
    inspected.catalog,
  );
  return {
    source: { bytes: reconstructed.png, mediaType: "image/png" },
    layout,
    catalog: effective,
  };
}
